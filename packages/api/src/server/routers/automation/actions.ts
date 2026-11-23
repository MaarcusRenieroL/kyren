import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "@zentro/db/drizzle";
import { automations, projects, tasks } from "@zentro/db/schema";
import { escalateDueTasks } from "../../automations/due-escalation";
import { taskPrioritySchema, taskStatusSchema } from "../../../types/zod-schema";
import { channelAccess } from "../../chat";
import { loadProjectById, projectFromInput } from "../../resources";
import {
  assertAnyPermission,
  listProcedure,
  permissionProcedure,
  router,
  type OrganizationContext,
  type ScopeResolver,
} from "../../trpc";

/** A rule's project, so changing it needs access to that project. */
const automationById: ScopeResolver = async ({ ctx, input }) => {
  const id = (input as { id?: unknown } | null)?.id;

  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return undefined;
  }

  const [rule] = await ctx.db
    .select({ projectId: automations.projectId })
    .from(automations)
    .where(
      and(
        eq(automations.id, id),
        eq(automations.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);
  const project = await loadProjectById(ctx, rule?.projectId);

  return project ? { project } : undefined;
};

/**
 * A rule without a project runs on every task in the organization, private
 * projects included, so only people who manage the organization may make,
 * switch or remove one.
 */
const ORG_WIDE_RULES = "org.settings.update";

async function assertMayChangeRule(ctx: OrganizationContext, id: string) {
  const [rule] = await ctx.db
    .select({ projectId: automations.projectId })
    .from(automations)
    .where(
      and(
        eq(automations.id, id),
        eq(automations.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!rule) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Automation rule not found.",
    });
  }

  if (!rule.projectId) await assertAnyPermission(ctx, [ORG_WIDE_RULES]);
}

// Rule settings are free-form, so cap their size instead of trusting callers.
const smallConfig = z
  .record(z.string().max(64), z.any()) // size-capped by the refine below
  .refine((value) => JSON.stringify(value).length <= 10_000, {
    message: "Rule settings are too large.",
  })
  .optional()
  .default({});


export const automationActionsProcedures = {
  toggle: permissionProcedure("tasks.update_any", automationById, {
    module: "tasks",
    also: [ORG_WIDE_RULES],
    audit: ["automation.toggled"],
  })
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      await assertMayChangeRule(ctx, input.id);

      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(automations)
          .set({ enabled: input.enabled, updatedAt: new Date() })
          .where(
            and(
              eq(automations.id, input.id),
              eq(automations.organizationId, activeOrganization.id),
            ),
          )
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Automation rule not found.",
          });
        }

        await ctx.audit.record(tx, {
          action: "automation.toggled",
          target: { id: updated.id, label: updated.name },
          projectId: updated.projectId,
          metadata: { enabled: updated.enabled },
        });

        return updated;
      });
    }),

  delete: permissionProcedure("tasks.delete_any", automationById, {
    module: "tasks",
    also: [ORG_WIDE_RULES],
    audit: ["automation.deleted"],
  })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      await assertMayChangeRule(ctx, input.id);

      return db.transaction(async (tx) => {
        const [deleted] = await tx
          .delete(automations)
          .where(
            and(
              eq(automations.id, input.id),
              eq(automations.organizationId, activeOrganization.id),
            ),
          )
          .returning();

        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Automation rule not found.",
          });
        }

        await ctx.audit.record(tx, {
          action: "automation.deleted",
          target: { id: deleted.id, label: deleted.name },
          projectId: deleted.projectId,
        });

        return deleted;
      });
    }),

  // The presets are org-wide rules, so they need what an org-wide rule needs.
  seedPresets: permissionProcedure(ORG_WIDE_RULES, undefined, {
    module: "tasks",
    audit: ["automation.presets_added"],
  }).mutation(async ({ ctx }) => {
    const { db, activeOrganization } = ctx;

    const presets = [
      {
        organizationId: activeOrganization.id,
        name: "Auto-transition parent on subtasks done",
        description:
          "When all subtasks of a task are marked done, transition parent task to Review.",
        enabled: true,
        triggerEvent: "task.subtasks_all_done",
        triggerConfig: {},
        actionType: "update_status",
        actionConfig: { targetStatus: "review" },
      },
      {
        organizationId: activeOrganization.id,
        name: "Auto-assign task on in-progress",
        description:
          "When a task transitions to In Progress and has no assignee, assign it to the active member.",
        enabled: true,
        triggerEvent: "task.status_changed",
        triggerConfig: { toStatus: "in-progress" },
        actionType: "assign_actor",
        actionConfig: {},
      },
      {
        organizationId: activeOrganization.id,
        name: "Auto-start task when blockers clear",
        description:
          "When a task's blocking dependencies are resolved, transition it to In Progress.",
        enabled: true,
        triggerEvent: "task.blockers_resolved",
        triggerConfig: {},
        actionType: "update_status",
        actionConfig: { targetStatus: "in-progress" },
      },
      {
        organizationId: activeOrganization.id,
        name: "Auto-escalate priority on approaching SLA due date",
        description:
          "When a task deadline is within 24 hours and still open, escalate priority to High.",
        enabled: true,
        triggerEvent: "task.due_date_approaching",
        triggerConfig: { withinHours: 24 },
        actionType: "set_priority",
        actionConfig: { priority: "high" },
      },
    ];

    return db.transaction(async (tx) => {
      // Checked under a lock, so a double click can't add them twice.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`automation-presets:${activeOrganization.id}`}, 0))`,
      );

      const existing = await tx
        .select({ id: automations.id })
        .from(automations)
        .where(eq(automations.organizationId, activeOrganization.id))
        .limit(1);

      if (existing.length > 0) {
        return { count: 0, message: "Presets already configured." };
      }

      const inserted = await tx.insert(automations).values(presets).returning();

      await ctx.audit.record(tx, {
        action: "automation.presets_added",
        target: { id: activeOrganization.id, label: activeOrganization.name },
        metadata: { count: inserted.length },
      });

      return { count: inserted.length, message: "Presets seeded." };
    });
  }),

  escalateDueSLA: permissionProcedure("tasks.update_any", undefined, {
    module: "tasks",
  }).mutation(async ({ ctx }) => {
    const escalated = await escalateDueTasks(ctx.db, {
      organizationId: ctx.activeOrganization.id,
      projectIds: await ctx.permissions.viewableProjectIds("tasks.update_any"),
    });

    return {
      escalatedCount: escalated.length,
      tasks: escalated.map((t) => ({ key: t.key, name: t.name })),
    };
  }),
};
