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
import { channelAccess } from "../chat";
import { projectFromInput } from "../resources";
import { listProcedure, permissionProcedure, router } from "../trpc";

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

  create: permissionProcedure("tasks.create", projectFromInput)
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
          "task.sla_breach_risk",
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
      const { db, activeOrganization, user } = ctx;

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

      if (input.actionType === "create_task" && !input.projectId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick the project the tasks should go in.",
        });
      }

      const [member] = await db
        .select({ id: automations.id })
        .from(automations)
        .where(
          and(
            eq(automations.name, input.name),
            eq(automations.organizationId, activeOrganization.id),
          ),
        );

      const [created] = await db
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

      return created;
    }),

  toggle: permissionProcedure("tasks.update_any")
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      const [updated] = await db
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

      return updated;
    }),

  delete: permissionProcedure("tasks.delete_any")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      const [deleted] = await db
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

      return deleted;
    }),

  seedPresets: permissionProcedure("tasks.create").mutation(async ({ ctx }) => {
    const { db, activeOrganization } = ctx;

    const existing = await db
      .select({ id: automations.id })
      .from(automations)
      .where(eq(automations.organizationId, activeOrganization.id));

    if (existing.length > 0) {
      return { count: 0, message: "Presets already configured." };
    }

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

    const inserted = await db.insert(automations).values(presets).returning();
    return { count: inserted.length, message: "Presets seeded." };
  }),

  escalateDueSLA: permissionProcedure("tasks.update_any").mutation(
    async ({ ctx }) => {
      const { db, activeOrganization } = ctx;
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find open tasks with dueAt in the past or within 24 hours that are not already high priority
      const urgentTasks = await db
        .select({
          id: tasks.id,
          key: tasks.key,
          name: tasks.name,
          priority: tasks.priority,
          dueAt: tasks.dueAt,
          projectId: tasks.projectId,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, activeOrganization.id),
            isNull(tasks.deletedAt),
            isNull(tasks.archivedAt),
            inArray(
              tasks.projectId,
              await ctx.permissions.viewableProjectIds("tasks.update_any"),
            ),
            ne(tasks.status, "done"),
            isNotNull(tasks.dueAt),
            lte(tasks.dueAt, in24Hours),
            ne(tasks.priority, "high"),
          ),
        );

      let escalatedCount = 0;
      for (const t of urgentTasks) {
        await db
          .update(tasks)
          .set({ priority: "high", updatedAt: new Date() })
          .where(eq(tasks.id, t.id));
        escalatedCount++;
      }

      // Update runCount on any active SLA automations
      if (escalatedCount > 0) {
        await db
          .update(automations)
          .set({
            runCount: sql`${automations.runCount} + ${escalatedCount}`,
            lastRunAt: new Date(),
          })
          .where(
            and(
              eq(automations.organizationId, activeOrganization.id),
              eq(automations.enabled, true),
              eq(automations.triggerEvent, "task.due_date_approaching"),
            ),
          );
      }

      return {
        escalatedCount,
        tasks: urgentTasks.map((t) => ({ key: t.key, name: t.name })),
      };
    },
  ),
});
