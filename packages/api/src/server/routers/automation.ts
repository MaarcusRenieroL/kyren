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
import { escalateDueTasks } from "../automations/due-escalation";
import { taskPrioritySchema, taskStatusSchema } from "../../types/zod-schema";
import { channelAccess } from "../chat";
import { loadProjectById, projectFromInput } from "../resources";
import {
  assertAnyPermission,
  listProcedure,
  permissionProcedure,
  router,
  type OrganizationContext,
  type ScopeResolver,
} from "../trpc";

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

export const automationRouter = router({
  getAll: listProcedure("tasks.view", "tasks").query(async ({ ctx }) => {
    const { db, activeOrganization } = ctx;

    const rows = await db
      .select({
        id: automations.id,
        name: automations.name,
        description: automations.description,
        enabled: automations.enabled,
        triggerEvent: automations.triggerEvent,
        triggerConfig: automations.triggerConfig,
        actionType: automations.actionType,
        actionConfig: automations.actionConfig,
        runCount: automations.runCount,
        lastRunAt: automations.lastRunAt,
        projectId: automations.projectId,
        projectName: projects.name,
        createdAt: automations.createdAt,
      })
      .from(automations)
      .leftJoin(projects, eq(projects.id, automations.projectId))
      .where(
        and(
          eq(automations.organizationId, activeOrganization.id),
          // Rules of a project the viewer cannot see stay out of their list.
          or(
            isNull(automations.projectId),
            inArray(
              automations.projectId,
              await ctx.permissions.viewableProjectIds("tasks.view"),
            ),
          ),
        ),
      )
      .orderBy(desc(automations.createdAt));

    return rows;
  }),

  create: permissionProcedure("tasks.create", projectFromInput, {
    module: "tasks",
    also: [ORG_WIDE_RULES],
    audit: ["automation.created"],
  })
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(2000).optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
        triggerEvent: z.enum([
          "task.status_changed",
          "task.subtasks_all_done",
          "task.blockers_resolved",
          "task.created",
          "task.due_date_approaching",
          "chat.message_contains",
        ]),
        triggerConfig: smallConfig,
        actionType: z.enum([
          "update_status",
          "assign_actor",
          "set_priority",
          "post_to_channel",
          "create_task",
        ]),
        actionConfig: smallConfig,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      if (!input.projectId) await assertAnyPermission(ctx, [ORG_WIDE_RULES]);

      // Rules that touch chat can only use conversations the creator can post
      // in, and a message trigger needs words to look for.
      if (input.triggerEvent === "chat.message_contains") {
        const contains = String(input.triggerConfig.contains ?? "").trim();

        if (!contains || contains.length > 100) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Say which words a message should contain.",
          });
        }
      }

      // A rule scoped to one conversation can only watch one its creator reads;
      // without a channel it only ever sees public ones (see the engine).
      if (input.triggerEvent === "chat.message_contains") {
        const scoped = input.triggerConfig.channelId;

        if (scoped !== undefined && scoped !== null && scoped !== "") {
          const readable = z.string().uuid().safeParse(scoped).success
            ? await channelAccess(ctx, String(scoped))
            : null;

          if (!readable?.canRead) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Pick a channel you can read.",
            });
          }
        }
      }

      if (input.actionType === "post_to_channel") {
        const channelId = String(input.actionConfig.channelId ?? "");
        const access = z.string().uuid().safeParse(channelId).success
          ? await channelAccess(ctx, channelId)
          : null;

        if (!access?.canPost) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Pick a channel you can post in.",
          });
        }
      }

      // A rule with an action it can never carry out would sit there doing
      // nothing, so refuse it now.
      if (
        input.actionType === "set_priority" &&
        !taskPrioritySchema.safeParse(input.actionConfig.priority).success
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick a priority: low, medium or high.",
        });
      }

      if (
        input.actionType === "update_status" &&
        !taskStatusSchema.safeParse(input.actionConfig.targetStatus).success
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick the status the task should move to.",
        });
      }

      if (input.actionType === "create_task" && !input.projectId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick the project the tasks should go in.",
        });
      }

      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(automations)
          .values({
            organizationId: activeOrganization.id,
            name: input.name,
            description: input.description ?? null,
            projectId: input.projectId ?? null,
            triggerEvent: input.triggerEvent,
            triggerConfig: input.triggerConfig,
            actionType: input.actionType,
            actionConfig: input.actionConfig,
          })
          .returning();

        await ctx.audit.record(tx, {
          action: "automation.created",
          target: { id: created!.id, label: created!.name },
          projectId: created!.projectId,
          metadata: {
            trigger: created!.triggerEvent,
            action: created!.actionType,
          },
        });

        return created;
      });
    }),

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
});
