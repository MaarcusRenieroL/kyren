import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "@zentro/db/drizzle";
import { members, projects, tasks } from "@zentro/db/schema";
import { sanitizeRichText } from "@zentro/utils";

import {
  createSubtaskSchema,
  importTasksSchema,
} from "../../../types/zod-schema";
import {
  assertAnyPermission,
  moduleProcedure,
  permissionProcedure,
} from "../../trpc";
import { enforceRateLimit } from "../../rate-limit";
import { postTaskEvent } from "../../chat-events";
import { loadProjectById, projectFromInput } from "../../resources";
import {
  getCurrentMember,
  getTaskForActiveOrganization,
} from "../task-helpers";

export const taskSubtaskProcedures = {
  importTasks: permissionProcedure("tasks.create", projectFromInput, {
    module: "tasks",
    audit: ["task.created"],
  })
    .input(importTasksSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;

      await enforceRateLimit(db, `api:import-tasks:${user.id}`, {
        max: 20,
        windowMs: 60 * 60 * 1000,
      });

      const memberId = (await getCurrentMember(ctx)).id;

      const created = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${input.projectId}, 0))`,
        );

        const [project] = await tx
          .select({
            id: projects.id,
            teamId: projects.teamId,
            taskKeyPrefix: projects.taskKeyPrefix,
          })
          .from(projects)
          .where(
            and(
              eq(projects.id, input.projectId),
              eq(projects.organizationId, activeOrganization.id),
            ),
          )
          .limit(1);

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found.",
          });
        }

        const [latest] = await tx
          .select({ taskNumber: tasks.taskNumber })
          .from(tasks)
          .where(eq(tasks.projectId, project.id))
          .orderBy(desc(tasks.taskNumber))
          .limit(1);
        let taskNumber = latest?.taskNumber ?? 0;

        for (const row of input.rows) {
          taskNumber += 1;

          const [task] = await tx
            .insert(tasks)
            .values({
              name: row.name,
              description: row.description
                ? sanitizeRichText(row.description)
                : null,
              status: row.status,
              completedAt: row.status === "done" ? new Date() : null,
              priority: row.priority,
              dueAt: row.dueAt,
              projectId: project.id,
              teamId: project.teamId,
              createdByMemberId: memberId,
              organizationId: activeOrganization.id,
              key: `${project.taskKeyPrefix}-${taskNumber}`,
              taskNumber,
            })
            .returning({ id: tasks.id, key: tasks.key, name: tasks.name });

          await ctx.audit.record(tx, {
            action: "task.created",
            target: { id: task!.id, label: task!.key },
            projectId: project.id,
            teamId: project.teamId,
            metadata: { name: task!.name, imported: true },
          });
        }

        return input.rows.length;
      });

      return { created };
    }),

  createSubtask: moduleProcedure("tasks")
    .meta({ permissions: ["tasks.create"] })
    .input(createSubtaskSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization, user } = ctx;
      const parentTask = await getTaskForActiveOrganization(
        ctx,
        input.parentTaskKey,
      );

      const parentProject =
        (await loadProjectById(ctx, parentTask.projectId)) ?? null;

      await assertAnyPermission(ctx, ["tasks.create"], {
        project: parentProject,
      });

      if (parentProject?.status === "archived") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This project is archived. Restore it to make changes.",
        });
      }

      if (input.assignedToMemberId) {
        await assertAnyPermission(ctx, ["tasks.assign"], {
          project: (await loadProjectById(ctx, parentTask.projectId)) ?? null,
        });

        const [assignee] = await db
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.id, input.assignedToMemberId),
              eq(members.organizationId, activeOrganization.id),
            ),
          )
          .limit(1);

        if (!assignee) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Assignee not found in active organization.",
          });
        }
      }

      const [member] = await db
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.userId, user.id),
            eq(members.organizationId, activeOrganization.id),
          ),
        )
        .limit(1);

      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found in active organization.",
        });
      }

      const [project] = await db
        .select({
          id: projects.id,
          taskKeyPrefix: projects.taskKeyPrefix,
        })
        .from(projects)
        .where(
          and(
            eq(projects.id, parentTask.projectId),
            eq(projects.organizationId, activeOrganization.id),
          ),
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found.",
        });
      }

      const createdSubtask = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${parentTask.projectId}, 0))`,
        );

        const [latestTask] = await tx
          .select({ taskNumber: tasks.taskNumber })
          .from(tasks)
          .where(eq(tasks.projectId, parentTask.projectId))
          .orderBy(desc(tasks.taskNumber))
          .limit(1);

        const taskNumber = (latestTask?.taskNumber ?? 0) + 1;
        const key = `${project.taskKeyPrefix}-${taskNumber}`;

        const [subtask] = await tx
          .insert(tasks)
          .values({
            organizationId: activeOrganization.id,
            projectId: parentTask.projectId,
            parentTaskId: parentTask.id,
            teamId: parentTask.teamId,
            key,
            taskNumber,
            name: input.name,
            status: "todo",
            priority: "medium",
            createdByMemberId: member.id,
            assignedToMemberId: input.assignedToMemberId ?? null,
          })
          .returning();

        if (!subtask) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create subtask.",
          });
        }

        await ctx.audit.record(tx, {
          action: "task.created",
          target: { id: subtask.id, label: subtask.key },
          projectId: subtask.projectId,
          teamId: subtask.teamId,
          metadata: {
            name: subtask.name,
            parentTaskId: parentTask.id,
            parentTaskKey: parentTask.key,
          },
        });

        return subtask;
      });

      await postTaskEvent(db, {
        organizationId: activeOrganization.id,
        actorMemberId: createdSubtask.createdByMemberId,
        event: "created",
        task: {
          id: createdSubtask.id,
          key: createdSubtask.key,
          name: createdSubtask.name,
          projectId: createdSubtask.projectId,
        },
      });

      return createdSubtask;
    }),
};
