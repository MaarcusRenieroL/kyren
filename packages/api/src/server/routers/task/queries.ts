import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from "@zentro/db/drizzle";
import {
  members,
  projects,
  tasks,
  taskTimeLogs,
  teams,
  users,
  workLinks,
} from "@zentro/db/schema";

import {
  getTaskByKeySchema,
  getTasksSchema,
} from "../../../types/zod-schema";
import { denialFor, listProcedure, moduleProcedure } from "../../trpc";
import { createDueRecurringTasksLazily } from "../../recurring-tasks";
import { taskByKey } from "../../resources";

export const taskQueryProcedures = {
  getTasksByOrgId: listProcedure("tasks.view", "tasks")
    .input(getTasksSchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      await createDueRecurringTasksLazily(
        db as unknown as Parameters<typeof createDueRecurringTasksLazily>[0],
      );

      const viewableProjectIds =
        await ctx.permissions.viewableProjectIds("tasks.view");

      if (!viewableProjectIds.length) {
        return [];
      }

      const conditions = [
        eq(tasks.organizationId, activeOrganization.id),
        isNull(tasks.deletedAt),
        inArray(tasks.projectId, viewableProjectIds),
      ];

      if (input.projectId) {
        conditions.push(eq(tasks.projectId, input.projectId));
      }

      if (input.teamId) {
        conditions.push(eq(tasks.teamId, input.teamId));
      }

      const allTasks = await db
        .select({
          id: tasks.id,
          key: tasks.key,
          name: tasks.name,
          description: tasks.description,
          project: projects.name,
          projectSlug: projects.slug,
          teamId: tasks.teamId,
          teamName: teams.name,
          teamColor: teams.color,
          status: tasks.status,
          priority: tasks.priority,
          assignee: users.name,
          assigneeUserId: users.id,
          due: tasks.dueAt,
          parentTaskId: tasks.parentTaskId,
          estimatePoints: tasks.estimatePoints,
          timeSpentMinutes: tasks.timeSpentMinutes,
          projectId: tasks.projectId,
          sprintId: tasks.sprintId,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .leftJoin(teams, eq(teams.id, tasks.teamId))
        .leftJoin(members, eq(members.id, tasks.assignedToMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(and(...conditions))
        .orderBy(desc(tasks.createdAt));

      const ids = allTasks.map((task) => task.id);
      const [blockers, subtaskCounts] = await Promise.all([
        ids.length
          ? db
              .select({ targetId: workLinks.targetId, key: tasks.key })
              .from(workLinks)
              .innerJoin(tasks, eq(tasks.id, workLinks.sourceId))
              .where(
                and(
                  eq(workLinks.organizationId, activeOrganization.id),
                  eq(workLinks.kind, "blocks"),
                  eq(workLinks.sourceType, "task"),
                  eq(workLinks.targetType, "task"),
                  inArray(workLinks.targetId, ids),
                  ne(tasks.status, "done"),
                  isNull(tasks.deletedAt),
                  inArray(tasks.projectId, viewableProjectIds),
                ),
              )
          : [],
        ids.length
          ? db
              .select({
                parentTaskId: tasks.parentTaskId,
                total: count(),
                done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`,
              })
              .from(tasks)
              .where(
                and(
                  eq(tasks.organizationId, activeOrganization.id),
                  inArray(tasks.parentTaskId, ids),
                  isNull(tasks.deletedAt),
                ),
              )
              .groupBy(tasks.parentTaskId)
          : [],
      ]);

      return allTasks.map((task) => {
        const sc = subtaskCounts.find((row) => row.parentTaskId === task.id);

        return {
          ...task,
          subtaskCount: sc
            ? { total: Number(sc.total), done: Number(sc.done) }
            : null,
          blockedBy: blockers
            .filter((row) => row.targetId === task.id)
            .map((row) => row.key),
        };
      });
    }),

  getTaskByKey: moduleProcedure("tasks")
    .meta({ permissions: ["tasks.view"] })
    .input(getTaskByKeySchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const { key } = input;
      const decision = await ctx.permissions.check(
        "tasks.view",
        await taskByKey("key")({ ctx, input }),
      );

      if (!decision.allowed) {
        const denial = denialFor(decision);

        if (denial.code === "NOT_FOUND") {
          return undefined;
        }

        throw denial;
      }

      const [task] = await db
        .select({
          id: tasks.id,
          key: tasks.key,
          taskNumber: tasks.taskNumber,
          name: tasks.name,
          description: tasks.description,
          projectId: projects.id,
          projectName: projects.name,
          projectSlug: projects.slug,
          teamId: tasks.teamId,
          teamName: teams.name,
          teamColor: teams.color,
          status: tasks.status,
          priority: tasks.priority,
          parentTaskId: tasks.parentTaskId,
          estimatePoints: tasks.estimatePoints,
          timeSpentMinutes: tasks.timeSpentMinutes,
          assignedToMemberId: tasks.assignedToMemberId,
          createdByMemberId: tasks.createdByMemberId,
          assignee: users.name,
          due: tasks.dueAt,
          completedAt: tasks.completedAt,
          sprintId: tasks.sprintId,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
        })
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .leftJoin(teams, eq(teams.id, tasks.teamId))
        .leftJoin(members, eq(members.id, tasks.assignedToMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(tasks.key, key),
            eq(tasks.organizationId, activeOrganization.id),
            isNull(tasks.deletedAt),
          ),
        )
        .limit(1);

      if (!task) {
        return task;
      }

      const [reporter, subtasks, parentTask, timeLogs] = await Promise.all([
        task.createdByMemberId
          ? db
              .select({
                name: users.name,
                email: users.email,
                userId: members.userId,
              })
              .from(members)
              .innerJoin(users, eq(users.id, members.userId))
              .where(
                and(
                  eq(members.id, task.createdByMemberId),
                  eq(members.organizationId, activeOrganization.id),
                ),
              )
              .limit(1)
              .then(([r]) => r ?? null)
          : Promise.resolve(null),
        db
          .select({
            id: tasks.id,
            key: tasks.key,
            taskNumber: tasks.taskNumber,
            name: tasks.name,
            status: tasks.status,
            priority: tasks.priority,
            assignee: users.name,
            due: tasks.dueAt,
            createdAt: tasks.createdAt,
          })
          .from(tasks)
          .leftJoin(members, eq(members.id, tasks.assignedToMemberId))
          .leftJoin(users, eq(users.id, members.userId))
          .where(
            and(
              eq(tasks.parentTaskId, task.id),
              eq(tasks.organizationId, activeOrganization.id),
              isNull(tasks.deletedAt),
            ),
          )
          .orderBy(asc(tasks.taskNumber)),
        task.parentTaskId
          ? db
              .select({
                id: tasks.id,
                key: tasks.key,
                name: tasks.name,
              })
              .from(tasks)
              .where(
                and(
                  eq(tasks.id, task.parentTaskId),
                  eq(tasks.organizationId, activeOrganization.id),
                  isNull(tasks.deletedAt),
                ),
              )
              .limit(1)
              .then(([p]) => p ?? null)
          : Promise.resolve(null),
        db
          .select({
            id: taskTimeLogs.id,
            durationMinutes: taskTimeLogs.durationMinutes,
            note: taskTimeLogs.note,
            createdAt: taskTimeLogs.createdAt,
            userName: users.name,
          })
          .from(taskTimeLogs)
          .leftJoin(members, eq(members.id, taskTimeLogs.memberId))
          .leftJoin(users, eq(users.id, members.userId))
          .where(eq(taskTimeLogs.taskId, task.id))
          .orderBy(desc(taskTimeLogs.createdAt)),
      ]);

      return {
        ...task,
        reporter: reporter?.name ?? reporter?.email ?? null,
        createdByUserId: reporter?.userId ?? null,
        subtasks,
        parentTask,
        timeLogs,
      };
    }),
};
