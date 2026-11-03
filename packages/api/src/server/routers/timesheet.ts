import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "@zentro/db/drizzle";
import {
  members,
  runningTimers,
  taskTimeLogs,
  tasks,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import type { DbHandle } from "../access";
import { taskByKey } from "../resources";
import { permissionProcedure, router } from "../trpc";
import { isoDate } from "../zod-common";
import { addTimeLog } from "./task-helpers";

const MAX_ENTRY_MINUTES = 24 * 60;
const MAX_RANGE_DAYS = 93;
const DAY = 86_400_000;

const viewer = () =>
  permissionProcedure("tasks.view", undefined, { module: "tasks" });
const onTask = () =>
  permissionProcedure("tasks.view", taskByKey("key"), { module: "tasks" });

const range = z.object({ from: isoDate, to: isoDate });

/** The range as UTC times: from the start of `from` up to the end of `to`. */
function bounds(input: { from: string; to: string }) {
  const start = new Date(`${input.from}T00:00:00Z`);
  const end = new Date(Date.parse(`${input.to}T00:00:00Z`) + DAY);
  const days = (end.getTime() - start.getTime()) / DAY;

  if (days < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The end date is before the start date.",
    });
  }

  if (days > MAX_RANGE_DAYS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Pick a range of up to ${MAX_RANGE_DAYS} days.`,
    });
  }

  return { start, end };
}

export const timesheetRouter = router({
  /** The person's running timer, with the task it is on. */
  running: viewer().query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        startedAt: runningTimers.startedAt,
        taskKey: tasks.key,
        taskName: tasks.name,
      })
      .from(runningTimers)
      .innerJoin(tasks, eq(tasks.id, runningTimers.taskId))
      .where(
        and(
          eq(runningTimers.organizationId, ctx.activeOrganization.id),
          eq(runningTimers.userId, ctx.user.id),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  }),

  /** Starts a timer on a task. A timer already running is stopped and logged first. */
  start: onTask()
    .input(z.object({ key: z.string().trim().min(1).max(40) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`timer:${ctx.user.id}`}, 0))`,
        );
        await finish(tx, ctx.activeOrganization.id, ctx.user.id);

        const [task] = await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.key, input.key),
              eq(tasks.organizationId, ctx.activeOrganization.id),
              isNull(tasks.deletedAt),
            ),
          )
          .limit(1);

        if (!task) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found.",
          });
        }

        await tx.insert(runningTimers).values({
          organizationId: ctx.activeOrganization.id,
          userId: ctx.user.id,
          taskId: task.id,
        });

        return { ok: true };
      });
    }),

  /** Stops the timer and logs the time on its task. Null when none was running. */
  stop: viewer().mutation(async ({ ctx }) => {
    return ctx.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`timer:${ctx.user.id}`}, 0))`,
      );

      return finish(tx, ctx.activeOrganization.id, ctx.user.id);
    });
  }),

  /** The person's own time logs in a range, newest first. */
  mine: viewer()
    .input(range)
    .query(async ({ ctx, input }) => {
      const { start, end } = bounds(input);
      const rows = await ctx.db
        .select({
          id: taskTimeLogs.id,
          at: taskTimeLogs.createdAt,
          minutes: taskTimeLogs.durationMinutes,
          note: taskTimeLogs.note,
          taskKey: tasks.key,
          taskName: tasks.name,
        })
        .from(taskTimeLogs)
        .innerJoin(members, eq(members.id, taskTimeLogs.memberId))
        .innerJoin(tasks, eq(tasks.id, taskTimeLogs.taskId))
        .where(
          and(
            eq(taskTimeLogs.organizationId, ctx.activeOrganization.id),
            eq(members.userId, ctx.user.id),
            gte(taskTimeLogs.createdAt, start),
            lt(taskTimeLogs.createdAt, end),
          ),
        )
        .orderBy(desc(taskTimeLogs.createdAt))
        .limit(1000);

      return {
        entries: rows.map((r) => ({
          ...r,
          day: r.at.toISOString().slice(0, 10),
        })),
        totalMinutes: rows.reduce((sum, r) => sum + r.minutes, 0),
      };
    }),

  /** Minutes per person and per task across the organization. */
  report: permissionProcedure("time.view_report", undefined, {
    module: "tasks",
  })
    .input(range)
    .query(async ({ ctx, input }) => {
      const { start, end } = bounds(input);
      const base = and(
        eq(taskTimeLogs.organizationId, ctx.activeOrganization.id),
        gte(taskTimeLogs.createdAt, start),
        lt(taskTimeLogs.createdAt, end),
      );
      const people = await ctx.db
        .select({
          name: users.name,
          minutes: sql<number>`sum(${taskTimeLogs.durationMinutes})::int`,
        })
        .from(taskTimeLogs)
        .innerJoin(members, eq(members.id, taskTimeLogs.memberId))
        .innerJoin(users, eq(users.id, members.userId))
        .where(base)
        .groupBy(users.id, users.name)
        .orderBy(asc(users.name));
      const byTask = await ctx.db
        .select({
          key: tasks.key,
          name: tasks.name,
          minutes: sql<number>`sum(${taskTimeLogs.durationMinutes})::int`,
        })
        .from(taskTimeLogs)
        .innerJoin(tasks, eq(tasks.id, taskTimeLogs.taskId))
        .where(base)
        .groupBy(tasks.id, tasks.key, tasks.name)
        .orderBy(desc(sql`sum(${taskTimeLogs.durationMinutes})`))
        .limit(50);

      return {
        people,
        tasks: byTask,
        totalMinutes: people.reduce((sum, p) => sum + p.minutes, 0),
      };
    }),
});

/** Turns a person's running timer into a time log. At least a minute, at most a day. */
async function finish(tx: DbHandle, organizationId: string, userId: string) {
  const [timer] = await tx
    .select()
    .from(runningTimers)
    .where(
      and(
        eq(runningTimers.organizationId, organizationId),
        eq(runningTimers.userId, userId),
      ),
    )
    .for("update");

  if (!timer) return null;

  await tx.delete(runningTimers).where(eq(runningTimers.id, timer.id));

  const [member] = await tx
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.userId, userId),
        eq(members.organizationId, organizationId),
      ),
    )
    .limit(1);
  const minutes = Math.min(
    MAX_ENTRY_MINUTES,
    Math.max(1, Math.ceil((Date.now() - timer.startedAt.getTime()) / 60_000)),
  );
  const { totalTimeSpentMinutes } = await addTimeLog(tx, {
    organizationId,
    taskId: timer.taskId,
    memberId: member?.id ?? null,
    durationMinutes: minutes,
    note: "Timer",
  });

  return { minutes, totalTimeSpentMinutes };
}
