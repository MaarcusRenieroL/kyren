import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, sql } from "@zentro/db/drizzle";
import {
  keyResultCheckIns,
  keyResults,
  keyResultTasks,
  members,
  objectives,
  tasks,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../../chat";
import { permissionProcedure, router } from "../../trpc";

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

const confidence = z.enum(["on_track", "at_risk", "off_track"]);

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


export const goalsObjectivesProcedures = {
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
        .where(
          and(
            eq(keyResults.organizationId, organizationId),
            // A deleted task is no longer part of the work.
            isNull(tasks.deletedAt),
          ),
        )
        .groupBy(keyResultTasks.keyResultId);
      const countOf = new Map(counts.map((c) => [c.keyResultId, c]));
      const latest = await ctx.db
        .selectDistinctOn([keyResultCheckIns.keyResultId], {
          keyResultId: keyResultCheckIns.keyResultId,
          confidence: keyResultCheckIns.confidence,
          at: keyResultCheckIns.createdAt,
        })
        .from(keyResultCheckIns)
        .innerJoin(keyResults, eq(keyResults.id, keyResultCheckIns.keyResultId))
        .where(eq(keyResults.organizationId, organizationId))
        .orderBy(
          keyResultCheckIns.keyResultId,
          desc(keyResultCheckIns.createdAt),
        );
      const latestOf = new Map(latest.map((l) => [l.keyResultId, l]));
      // Who may move a metric: goal managers, and each result's owner.
      const managesGoals = await ctx.permissions.can("tasks.manage_goals");
      const me = await currentMemberId(ctx);

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

            const last = latestOf.get(r.id);

            return {
              ...r,
              confidence: last
                ? (last.confidence as z.infer<typeof confidence>)
                : null,
              lastCheckInAt: last?.at ?? null,
              totalTasks,
              doneTasks,
              progress,
              canUpdate:
                r.kind === "metric" && (managesGoals || r.ownerMemberId === me),
            };
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

};
