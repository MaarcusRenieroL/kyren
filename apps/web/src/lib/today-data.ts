import {
  createPermissionContext,
  visibleActivityCondition,
} from "@zentro/api/server";
import { db } from "@zentro/db";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  ne,
  sql,
} from "@zentro/db/drizzle";
import {
  activityEvents,
  members,
  projects,
  runningTimers,
  tasks,
  users,
} from "@zentro/db/schema";
import type { ModuleId } from "@zentro/modules";
import { can, type PermissionSnapshot } from "@zentro/permissions";

import { paths } from "~/src/lib/paths";
import { zonedDate, zonedMidnight } from "~/src/lib/time-zone";
import {
  weekdayLetter,
  verbFor,
  type StatusChange,
  type TodayData,
} from "./today-types";

export type { TodayData, TodayPulseItem, TodayTask } from "./today-types";

export async function getTodayData({
  organizationId,
  userId,
  enabledModules,
  snapshot,
  timeZone,
}: {
  organizationId: string;
  userId: string;
  enabledModules: ReadonlySet<string>;
  snapshot: PermissionSnapshot;
  /** The viewer's IANA zone, already checked with `safeTimeZone`. */
  timeZone: string;
}): Promise<TodayData> {
  const empty: TodayData = {
    memberId: null,
    timer: null,
    tasks: [],
    doneToday: 0,
    pulse: [],
    week: [],
    unassignedNext: null,
    hasAnyTasks: false,
  };

  if (!enabledModules.has("tasks")) return empty;

  const projectRows = await db
    .select({
      id: projects.id,
      teamId: projects.teamId,
      visibility: projects.visibility,
    })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, organizationId),
        isNull(projects.deletedAt),
      ),
    );
  const taskProjectIds = projectRows
    .filter((project) => can(snapshot, "tasks.view", { project }))
    .map((project) => project.id);
  const tasksVisible = taskProjectIds.length
    ? inArray(tasks.projectId, taskProjectIds)
    : sql`false`;

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        eq(members.userId, userId),
      ),
    )
    .limit(1);
  const memberId = member?.id ?? null;
  // "Today" is the viewer's day, not the server's.
  const now = new Date();
  const todayStart = zonedMidnight(timeZone, now);
  const weekStart = zonedMidnight(timeZone, now, 6);

  const visible = await visibleActivityCondition(
    createPermissionContext(db, organizationId, userId),
    enabledModules as ReadonlySet<ModuleId>,
  );
  const taskEvent = and(
    eq(activityEvents.organizationId, organizationId),
    eq(activityEvents.auditOnly, false),
    eq(activityEvents.targetType, "task"),
    sql`${activityEvents.action} in ('task.created', 'task.status_changed')`,
    visible,
  );

  const [open, doneRows, pulseRows, weekRows, unowned, anyTask] =
    await Promise.all([
      memberId
        ? db
            .select({
              id: tasks.id,
              key: tasks.key,
              name: tasks.name,
              status: tasks.status,
              priority: tasks.priority,
              dueAt: tasks.dueAt,
              createdAt: tasks.createdAt,
              projectName: projects.name,
              projectSlug: projects.slug,
            })
            .from(tasks)
            .innerJoin(projects, eq(projects.id, tasks.projectId))
            .where(
              and(
                eq(tasks.organizationId, organizationId),
                tasksVisible,
                eq(tasks.assignedToMemberId, memberId),
                ne(tasks.status, "done"),
                isNull(tasks.deletedAt),
                isNull(tasks.archivedAt),
              ),
            )
            .orderBy(asc(tasks.createdAt))
            .limit(60)
        : Promise.resolve([]),
      db
        .select({ targetId: activityEvents.targetId })
        .from(activityEvents)
        .where(
          and(
            eq(activityEvents.organizationId, organizationId),
            eq(activityEvents.targetType, "task"),
            eq(activityEvents.action, "task.status_changed"),
            eq(activityEvents.actorUserId, userId),
            gte(activityEvents.createdAt, todayStart),
            sql`${activityEvents.metadata} -> 'changes' -> 0 ->> 'to' = 'done'`,
          ),
        )
        .groupBy(activityEvents.targetId),
      db
        .select({
          id: activityEvents.id,
          action: activityEvents.action,
          targetId: activityEvents.targetId,
          targetLabel: activityEvents.targetLabel,
          metadata: activityEvents.metadata,
          createdAt: activityEvents.createdAt,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(activityEvents)
        .leftJoin(users, eq(users.id, activityEvents.actorUserId))
        .where(and(taskEvent, gte(activityEvents.createdAt, todayStart)))
        .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
        .limit(10),
      db
        .select({
          day: sql<string>`to_char((${activityEvents.createdAt} at time zone 'UTC') at time zone ${timeZone}, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(activityEvents)
        .where(and(taskEvent, gte(activityEvents.createdAt, weekStart)))
        .groupBy(sql`1`),
      memberId
        ? db
            .select({ key: tasks.key, name: tasks.name })
            .from(tasks)
            .where(
              and(
                eq(tasks.organizationId, organizationId),
                tasksVisible,
                isNull(tasks.assignedToMemberId),
                ne(tasks.status, "done"),
                isNull(tasks.deletedAt),
                isNull(tasks.archivedAt),
              ),
            )
            .orderBy(
              sql`case ${tasks.priority} when 'high' then 0 when 'medium' then 1 else 2 end`,
              asc(tasks.createdAt),
            )
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            tasksVisible,
            isNull(tasks.deletedAt),
          ),
        )
        .limit(1),
    ]);

  const [timer] = await db
    .select({ taskKey: tasks.key, startedAt: runningTimers.startedAt })
    .from(runningTimers)
    .innerJoin(tasks, eq(tasks.id, runningTimers.taskId))
    .where(
      and(
        eq(runningTimers.organizationId, organizationId),
        eq(runningTimers.userId, userId),
        isNull(tasks.deletedAt),
      ),
    )
    .limit(1);

  const counts = new Map(weekRows.map((row) => [row.day, row.count]));
  const today = zonedDate(now, timeZone);
  const week = Array.from({ length: 7 }, (_, index) => {
    // Calendar arithmetic only: a UTC date stands in for the viewer's date.
    const date = new Date(
      Date.UTC(today.year, today.month - 1, today.day - 6 + index),
    );

    return {
      label: weekdayLetter[date.getUTCDay()]!,
      count: counts.get(date.toISOString().slice(0, 10)) ?? 0,
    };
  });

  return {
    memberId,
    timer: timer
      ? { taskKey: timer.taskKey, startedAt: timer.startedAt.toISOString() }
      : null,
    tasks: open.map((task) => ({
      id: task.id,
      key: task.key,
      name: task.name,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      projectName: task.projectName,
      projectSlug: task.projectSlug,
      href: paths.task(task.key),
    })),
    doneToday: doneRows.length,
    pulse: pulseRows
      .filter((row) => row.targetLabel)
      .map((row) => ({
        id: row.id,
        actor: (row.actorName || row.actorEmail || "Someone").split(" ")[0]!,
        verb: verbFor(row.action, row.metadata as StatusChange),
        taskKey: row.targetLabel!,
        title: String((row.metadata as { name?: string })?.name ?? ""),
        href: paths.task(row.targetLabel!),
        at: row.createdAt.toISOString(),
      })),
    week,
    unassignedNext: unowned[0] ?? null,
    hasAnyTasks: anyTask.length > 0,
  };
}
