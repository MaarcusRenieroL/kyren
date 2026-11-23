import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  sql,
} from "@zentro/db/drizzle";
import {
  activityEvents,
  members,
  projects,
  tasks,
  users,
} from "@zentro/db/schema";

import { listProcedure } from "../../trpc";

export const taskOverviewProcedures = {
  getOverview: listProcedure("tasks.view", "tasks").query(async ({ ctx }) => {
    const { db, user, activeOrganization } = ctx;
    const organizationId = activeOrganization.id;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const viewableProjectIds =
      await ctx.permissions.viewableProjectIds("tasks.view");

    if (!viewableProjectIds.length) {
      return {
        counts: {
          createdLast7Days: 0,
          updatedLast7Days: 0,
          completedLast7Days: 0,
          dueNext7Days: 0,
          overdue: 0,
        },
        byStatus: [] as { status: string; count: number }[],
        byPriority: [] as { priority: string; count: number }[],
        assignedToMe: [],
        overdue: [],
        recentlyUpdated: [],
        activity: [],
      };
    }

    const active = and(
      eq(tasks.organizationId, organizationId),
      isNull(tasks.deletedAt),
      inArray(tasks.projectId, viewableProjectIds),
    );
    const open = and(active, ne(tasks.status, "done"));
    const taskColumns = {
      id: tasks.id,
      key: tasks.key,
      name: tasks.name,
      status: tasks.status,
      priority: tasks.priority,
      dueAt: tasks.dueAt,
      updatedAt: tasks.updatedAt,
      project: projects.name,
    };

    const [currentMember] = await db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.userId, user.id),
          eq(members.organizationId, organizationId),
        ),
      )
      .limit(1);

    const [
      statusRows,
      priorityRows,
      [created],
      [updated],
      [completed],
      [dueSoon],
      assigned,
      overdue,
      recentlyUpdated,
      activity,
    ] = await Promise.all([
      db
        .select({ status: tasks.status, count: count() })
        .from(tasks)
        .where(active)
        .groupBy(tasks.status),
      db
        .select({ priority: tasks.priority, count: count() })
        .from(tasks)
        .where(active)
        .groupBy(tasks.priority),
      db
        .select({ count: count() })
        .from(tasks)
        .where(and(active, gte(tasks.createdAt, weekAgo))),
      db
        .select({ count: count() })
        .from(tasks)
        .where(and(active, gte(tasks.updatedAt, weekAgo))),
      db
        .select({ count: count() })
        .from(activityEvents)
        .innerJoin(tasks, eq(sql`${tasks.id}::text`, activityEvents.targetId))
        .where(
          and(
            active,
            eq(activityEvents.organizationId, organizationId),
            eq(activityEvents.action, "task.status_changed"),
            sql`${activityEvents.metadata}->'changes'->0->>'to' = 'done'`,
            gte(activityEvents.createdAt, weekAgo),
          ),
        ),
      db
        .select({ count: count() })
        .from(tasks)
        .where(and(open, gte(tasks.dueAt, now), lte(tasks.dueAt, weekAhead))),
      currentMember
        ? db
            .select(taskColumns)
            .from(tasks)
            .innerJoin(projects, eq(projects.id, tasks.projectId))
            .where(and(open, eq(tasks.assignedToMemberId, currentMember.id)))
            .orderBy(sql`${tasks.dueAt} asc nulls last`, desc(tasks.updatedAt))
            .limit(6)
        : Promise.resolve([]),
      db
        .select(taskColumns)
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .where(and(open, isNotNull(tasks.dueAt), lt(tasks.dueAt, now)))
        .orderBy(asc(tasks.dueAt))
        .limit(6),
      db
        .select(taskColumns)
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .where(active)
        .orderBy(desc(tasks.updatedAt))
        .limit(6),
      db
        .select({
          id: activityEvents.id,
          action: activityEvents.action,
          metadata: activityEvents.metadata,
          createdAt: activityEvents.createdAt,
          actor: users.name,
          taskKey: tasks.key,
          taskName: tasks.name,
        })
        .from(activityEvents)
        .innerJoin(tasks, eq(sql`${tasks.id}::text`, activityEvents.targetId))
        .leftJoin(users, eq(users.id, activityEvents.actorUserId))
        .where(
          and(
            eq(activityEvents.organizationId, organizationId),
            eq(activityEvents.targetType, "task"),
            eq(activityEvents.auditOnly, false),
            isNull(tasks.deletedAt),
            inArray(tasks.projectId, viewableProjectIds),
          ),
        )
        .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
        .limit(20)
        .then((rows) =>
          rows.map((row) => {
            const change = (
              row.metadata?.changes as
                | Array<{ field: string; to: string | null }>
                | undefined
            )?.[0];

            return {
              id: row.id,
              type:
                row.action === "task.comment_added"
                  ? "comment.created"
                  : row.action === "task.created" ||
                      row.action === "task.deleted"
                    ? row.action
                    : "task.updated",
              field: change?.field ?? null,
              toValue: change?.to ?? null,
              createdAt: row.createdAt,
              actor: row.actor,
              taskKey: row.taskKey,
              taskName: row.taskName,
            };
          }),
        ),
    ]);

    const [overdueCount] = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(open, isNotNull(tasks.dueAt), lt(tasks.dueAt, now)));

    return {
      counts: {
        createdLast7Days: created?.count ?? 0,
        updatedLast7Days: updated?.count ?? 0,
        completedLast7Days: completed?.count ?? 0,
        dueNext7Days: dueSoon?.count ?? 0,
        overdue: overdueCount?.count ?? 0,
      },
      byStatus: statusRows,
      byPriority: priorityRows,
      assignedToMe: assigned,
      overdue,
      recentlyUpdated,
      activity,
    };
  }),
};
