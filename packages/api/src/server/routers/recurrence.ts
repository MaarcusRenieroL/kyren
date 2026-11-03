import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "@zentro/db/drizzle";
import { members, taskRecurrences } from "@zentro/db/schema";
import { sanitizeRichText } from "@zentro/utils";
import { z } from "zod";

import { currentMemberId } from "../chat";
import { loadProjectById, projectFromInput } from "../resources";
import { assertAnyPermission, permissionProcedure, router } from "../trpc";

const procedure = (audit?: string[]) =>
  permissionProcedure("tasks.create", projectFromInput, {
    module: "tasks",
    audit,
  });

const scope = (organizationId: string, projectId: string) =>
  and(
    eq(taskRecurrences.organizationId, organizationId),
    eq(taskRecurrences.projectId, projectId),
  );

export const recurrenceRouter = router({
  /** The repeating tasks of one project. */
  list: procedure()
    .input(z.object({ projectId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(taskRecurrences)
        .where(scope(ctx.activeOrganization.id, input.projectId))
        .orderBy(asc(taskRecurrences.createdAt)),
    ),

  create: procedure(["recurrence.created"])
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(10_000).optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        assignedToMemberId: z.string().uuid().nullable().optional(),
        dueInDays: z.number().int().min(0).max(365).nullable().optional(),
        cadence: z.enum(["daily", "weekly", "monthly"]),
        startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const project = await loadProjectById(ctx, input.projectId);

      // A project of another organisation reads as missing.
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const startsOn = new Date(`${input.startsOn}T09:00:00.000Z`);

      if (Number.isNaN(startsOn.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick a start date.",
        });
      }

      if (input.assignedToMemberId) {
        await assertAnyPermission(ctx, ["tasks.assign"], { project });

        const [assignee] = await ctx.db
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.id, input.assignedToMemberId),
              eq(members.organizationId, organizationId),
            ),
          )
          .limit(1);

        if (!assignee) throw new TRPCError({ code: "NOT_FOUND" });
      }

      const memberId = await currentMemberId(ctx);

      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(taskRecurrences)
          .values({
            organizationId,
            projectId: input.projectId,
            name: input.name,
            description: input.description
              ? sanitizeRichText(input.description)
              : null,
            priority: input.priority,
            assignedToMemberId: input.assignedToMemberId ?? null,
            dueInDays: input.dueInDays ?? null,
            cadence: input.cadence,
            nextRunAt: startsOn,
            createdByMemberId: memberId,
          })
          .returning();

        await ctx.audit.record(tx, {
          action: "recurrence.created",
          target: { id: row!.id, label: row!.name },
          projectId: input.projectId,
        });

        return row!;
      });
    }),

  setEnabled: procedure(["recurrence.paused"])
    .input(
      z.object({
        projectId: z.string().uuid(),
        id: z.string().uuid(),
        enabled: z.boolean(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .update(taskRecurrences)
          .set({ enabled: input.enabled })
          .where(
            and(
              scope(ctx.activeOrganization.id, input.projectId),
              eq(taskRecurrences.id, input.id),
            ),
          )
          .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "recurrence.paused",
          target: { id: row.id, label: row.name },
          projectId: input.projectId,
          metadata: { enabled: input.enabled },
        });

        return row;
      }),
    ),

  remove: procedure(["recurrence.removed"])
    .input(z.object({ projectId: z.string().uuid(), id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .delete(taskRecurrences)
          .where(
            and(
              scope(ctx.activeOrganization.id, input.projectId),
              eq(taskRecurrences.id, input.id),
            ),
          )
          .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "recurrence.removed",
          target: { id: row.id, label: row.name },
          projectId: input.projectId,
        });

        return { ok: true };
      }),
    ),
});
