import { and, asc, desc, eq, lte } from "@zentro/db/drizzle";
import { members, projects, taskRecurrences, tasks } from "@zentro/db/schema";
import { sql } from "@zentro/db/drizzle";

import type { DbHandle } from "./access";

type Db = DbHandle & {
  transaction: <T>(run: (tx: DbHandle) => Promise<T>) => Promise<T>;
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export type Cadence = "daily" | "weekly" | "monthly";

const DAY = 86_400_000;

/** The first date on the schedule that comes after `after`, counting on from `from`. */
export function nextOccurrence(from: Date, cadence: Cadence, after: Date) {
  let next = from;

  for (let i = 0; i < 5_000 && next.getTime() <= after.getTime(); i += 1) {
    if (cadence === "monthly") {
      const target = new Date(next);

      target.setUTCDate(1);
      target.setUTCMonth(target.getUTCMonth() + 1);

      const lastDay = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
      ).getUTCDate();

      target.setUTCDate(Math.min(from.getUTCDate(), lastDay));
      next = target;
    } else {
      next = new Date(next.getTime() + (cadence === "daily" ? DAY : 7 * DAY));
    }
  }

  return next;
}

/**
 * Creates one task for every repeating rule that has fallen due. A rule that
 * is weeks late still creates just one, then moves on past `now`. Returns how
 * many tasks were created.
 */
export async function createDueRecurringTasks(
  db: Db,
  now = new Date(),
  organizationId?: string,
) {
  const due = await db
    .select()
    .from(taskRecurrences)
    .where(
      and(
        eq(taskRecurrences.enabled, true),
        lte(taskRecurrences.nextRunAt, now),
      ),
    )
    .orderBy(asc(taskRecurrences.nextRunAt))
    .limit(100);
  let created = 0;

  for (const rule of due) {
    const next = nextOccurrence(rule.nextRunAt, rule.cadence as Cadence, now);

    const made = await db.transaction(async (tx) => {
      // Claim it first so two runs never create it twice.
      const claimed = await tx
        .update(taskRecurrences)
        .set({ nextRunAt: next, lastRunAt: now })
        .where(
          and(
            eq(taskRecurrences.id, rule.id),
            eq(taskRecurrences.nextRunAt, rule.nextRunAt),
          ),
        )
        .returning({ id: taskRecurrences.id });

      if (!claimed.length) return false;

      await (tx as unknown as Pick<Db, "execute">).execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${rule.projectId}, 0))`,
      );

      const [project] = await tx
        .select({
          id: projects.id,
          teamId: projects.teamId,
          taskKeyPrefix: projects.taskKeyPrefix,
        })
        .from(projects)
        .where(eq(projects.id, rule.projectId))
        .limit(1);

      if (!project) return false;

      const [latest] = await tx
        .select({ taskNumber: tasks.taskNumber })
        .from(tasks)
        .where(eq(tasks.projectId, project.id))
        .orderBy(desc(tasks.taskNumber))
        .limit(1);
      const taskNumber = (latest?.taskNumber ?? 0) + 1;

      // Someone who left the organisation since leaves the task unassigned.
      const [assignee] = rule.assignedToMemberId
        ? await tx
            .select({ id: members.id })
            .from(members)
            .where(eq(members.id, rule.assignedToMemberId))
            .limit(1)
        : [];

      await tx.insert(tasks).values({
        organizationId: rule.organizationId,
        projectId: project.id,
        teamId: project.teamId,
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
        assignedToMemberId: assignee?.id ?? null,
        createdByMemberId: rule.createdByMemberId,
        dueAt:
          rule.dueInDays === null
            ? null
            : new Date(now.getTime() + rule.dueInDays * DAY),
        taskNumber,
        key: `${project.taskKeyPrefix}-${taskNumber}`,
      });

      return true;
    });

    if (made) created += 1;
  }

  return created;
}

let lastLazyRun = 0;

/** A cheap check from a task list load, at most every 20 seconds per server. */
export async function createDueRecurringTasksLazily(db: Db) {
  if (Date.now() - lastLazyRun < 20_000) return;

  lastLazyRun = Date.now();

  try {
    await createDueRecurringTasks(db);
  } catch (error) {
    console.error("[tasks] repeating tasks failed", error);
  }
}
