import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, sql } from "@zentro/db/drizzle";
import {
  keyResults,
  keyResultTasks,
  objectives,
  tasks,
} from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../chat";
import { permissionProcedure, router } from "../trpc";

const uuid = z.string().uuid();

const objectiveInput = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  period: z.string().trim().max(40).nullable().optional(),
  status: z.enum(["active", "closed"]),
  ownerMemberId: uuid.nullable().optional(),
});

const keyResultInput = z.object({
  id: uuid.optional(),
  objectiveId: uuid,
  title: z.string().trim().min(1).max(160),
  kind: z.enum(["metric", "tasks"]),
  startValue: z.number().finite().optional(),
  targetValue: z.number().finite().optional(),
  currentValue: z.number().finite().optional(),
  unit: z.string().trim().max(24).nullable().optional(),
  ownerMemberId: uuid.nullable().optional(),
});

const manage = (audit: string[]) =>
  permissionProcedure("tasks.manage_goals", undefined, {
    module: "tasks",
    audit,
  });

/** How far a metric has moved from its start to its target, from 0 to 1. */
export function metricProgress(start: number, target: number, current: number) {
  if (target === start) return current >= target ? 1 : 0;

  return Math.min(1, Math.max(0, (current - start) / (target - start)));
}

export const goalsRouter = router({
  /**
   * Goals with their key results and progress. Linked tasks only appear as
   * counts, so nobody learns about a task from a project they cannot see.
   */
  list: permissionProcedure("tasks.view", undefined, { module: "tasks" }).query(
    async ({ ctx }) => {
      const organizationId = ctx.activeOrganization.id;
      const goals = await ctx.db
        .select()
        .from(objectives)
        .where(eq(objectives.organizationId, organizationId))
        .orderBy(asc(objectives.createdAt));
      const results = await ctx.db
        .select()
        .from(keyResults)
        .where(eq(keyResults.organizationId, organizationId))
        .orderBy(asc(keyResults.createdAt));
      const counts = await ctx.db
        .select({
          keyResultId: keyResultTasks.keyResultId,
          total: sql<number>`count(*)::int`,
          done: sql<number>`(count(*) filter (where ${tasks.status} = 'done'))::int`,
        })
        .from(keyResultTasks)
        .innerJoin(tasks, eq(tasks.id, keyResultTasks.taskId))
        .innerJoin(keyResults, eq(keyResults.id, keyResultTasks.keyResultId))
        .where(eq(keyResults.organizationId, organizationId))
        .groupBy(keyResultTasks.keyResultId);
      const countOf = new Map(counts.map((c) => [c.keyResultId, c]));

      return goals.map((goal) => {
        const mine = results
          .filter((r) => r.objectiveId === goal.id)
          .map((r) => {
            const c = countOf.get(r.id);
            const totalTasks = c?.total ?? 0;
            const doneTasks = c?.done ?? 0;
            const progress =
              r.kind === "tasks"
                ? totalTasks === 0
                  ? 0
                  : doneTasks / totalTasks
                : metricProgress(r.startValue, r.targetValue, r.currentValue);

            return { ...r, totalTasks, doneTasks, progress };
          });

        return {
          ...goal,
          keyResults: mine,
          progress: mine.length
            ? mine.reduce((sum, r) => sum + r.progress, 0) / mine.length
            : 0,
        };
      });
    },
  ),

  saveObjective: manage(["goal.saved"])
    .input(objectiveInput)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const values = {
        title: input.title,
        description: input.description || null,
        period: input.period || null,
        status: input.status,
        ownerMemberId: input.ownerMemberId ?? null,
        updatedAt: new Date(),
      };

      return ctx.db.transaction(async (tx) => {
        const [row] = input.id
          ? await tx
              .update(objectives)
              .set(values)
              .where(
                and(
                  eq(objectives.id, input.id),
                  eq(objectives.organizationId, organizationId),
                ),
              )
              .returning()
          : await tx
              .insert(objectives)
              .values({
                ...values,
                organizationId,
                ownerMemberId:
                  input.ownerMemberId ?? (await currentMemberId(ctx)),
              })
              .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "goal.saved",
          target: { id: row.id, label: row.title },
        });

        return row;
      });
    }),

  removeObjective: manage(["goal.deleted"])
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .delete(objectives)
          .where(
            and(
              eq(objectives.id, input.id),
              eq(objectives.organizationId, ctx.activeOrganization.id),
            ),
          )
          .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "goal.deleted",
          target: { id: row.id, label: row.title },
        });

        return { ok: true };
      }),
    ),

  saveKeyResult: manage(["goal.saved"])
    .input(keyResultInput)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const [objective] = await ctx.db
        .select({ id: objectives.id, title: objectives.title })
        .from(objectives)
        .where(
          and(
            eq(objectives.id, input.objectiveId),
            eq(objectives.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!objective) throw new TRPCError({ code: "NOT_FOUND" });

      const values = {
        title: input.title,
        kind: input.kind,
        startValue: input.startValue ?? 0,
        targetValue: input.targetValue ?? 100,
        currentValue: input.currentValue ?? input.startValue ?? 0,
        unit: input.unit || null,
        ownerMemberId: input.ownerMemberId ?? null,
        updatedAt: new Date(),
      };

      return ctx.db.transaction(async (tx) => {
        const [row] = input.id
          ? await tx
              .update(keyResults)
              .set(values)
              .where(
                and(
                  eq(keyResults.id, input.id),
                  eq(keyResults.objectiveId, objective.id),
                  eq(keyResults.organizationId, organizationId),
                ),
              )
              .returning()
          : await tx
              .insert(keyResults)
              .values({ ...values, organizationId, objectiveId: objective.id })
              .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "goal.saved",
          target: { id: row.id, label: `${objective.title}: ${row.title}` },
        });

        return row;
      });
    }),

  removeKeyResult: manage(["goal.deleted"])
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .delete(keyResults)
          .where(
            and(
              eq(keyResults.id, input.id),
              eq(keyResults.organizationId, ctx.activeOrganization.id),
            ),
          )
          .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "goal.deleted",
          target: { id: row.id, label: row.title },
        });

        return { ok: true };
      }),
    ),

  /** Links tasks by key. Keys that are unknown or not viewable are skipped. */
  linkTasks: manage(["goal.saved"])
    .input(
      z.object({
        keyResultId: uuid,
        keys: z.array(z.string().trim().min(1).max(40)).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const [kr] = await ctx.db
        .select()
        .from(keyResults)
        .where(
          and(
            eq(keyResults.id, input.keyResultId),
            eq(keyResults.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!kr) throw new TRPCError({ code: "NOT_FOUND" });

      const viewable = await ctx.permissions.viewableProjectIds("tasks.view");
      const found = viewable.length
        ? await ctx.db
            .select({ id: tasks.id })
            .from(tasks)
            .where(
              and(
                eq(tasks.organizationId, organizationId),
                inArray(tasks.key, input.keys),
                inArray(tasks.projectId, viewable),
              ),
            )
        : [];

      return ctx.db.transaction(async (tx) => {
        if (found.length) {
          await tx
            .insert(keyResultTasks)
            .values(found.map((t) => ({ keyResultId: kr.id, taskId: t.id })))
            .onConflictDoNothing();
        }

        await ctx.audit.record(tx, {
          action: "goal.saved",
          target: { id: kr.id, label: kr.title },
        });

        return { linked: found.length };
      });
    }),

  /** A key result's owner can move its number without managing goals. */
  updateValue: permissionProcedure("tasks.view", undefined, {
    module: "tasks",
    audit: ["goal.saved"],
  })
    .input(z.object({ keyResultId: uuid, currentValue: z.number().finite() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const [kr] = await ctx.db
        .select()
        .from(keyResults)
        .where(
          and(
            eq(keyResults.id, input.keyResultId),
            eq(keyResults.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!kr) throw new TRPCError({ code: "NOT_FOUND" });

      const mine = kr.ownerMemberId === (await currentMemberId(ctx));

      if (
        kr.kind !== "metric" ||
        !(mine || (await ctx.permissions.can("tasks.manage_goals")))
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.transaction(async (tx) => {
        await tx
          .update(keyResults)
          .set({ currentValue: input.currentValue, updatedAt: new Date() })
          .where(eq(keyResults.id, kr.id));
        await ctx.audit.record(tx, {
          action: "goal.saved",
          target: { id: kr.id, label: kr.title },
        });

        return { ok: true };
      });
    }),
});
