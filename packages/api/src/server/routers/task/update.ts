import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "@kyren/db/drizzle";
import { members, projects, tasks, teams, users } from "@kyren/db/schema";
import { sanitizeRichText } from "@kyren/utils";

import { updateTaskByKeySchema } from "../../../types/zod-schema";
import { assertAnyPermission, permissionProcedure } from "../../trpc";
import { syncMentions } from "../../mentions";
import { loadProjectById, taskByKey } from "../../resources";
import {
  getChangedTaskFields,
  getCurrentMember,
  getTaskForActiveOrganization,
  recordTaskChanges,
  triggerDownstreamUnblocks,
} from "../task-helpers";
import { assertParentTask, notifyAndAutomateTaskUpdate } from "./helpers";

export const taskUpdateProcedures = {
  updateTaskByKey: permissionProcedure("tasks.update_own", taskByKey("key"), {
    module: "tasks",
    also: ["tasks.assign"],
    audit: [
      "task.updated",
      "task.status_changed",
      "task.assigned",
      "task.unblocked",
    ],
  })
    .input(updateTaskByKeySchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const { key, ...values } = input;
      const previousTask = await getTaskForActiveOrganization(ctx, key);

      if (values.assignedToMemberId !== undefined) {
        await assertAnyPermission(ctx, ["tasks.assign"], {
          project: (await loadProjectById(ctx, previousTask.projectId)) ?? null,
          teamId: previousTask.teamId,
        });
      }
      if (values.assignedToMemberId) {
        const [assignee] = await db
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.id, values.assignedToMemberId),
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

      const updateValues: {
        name?: string;
        description?: string | null;
        status?: string;
        priority?: string;
        assignedToMemberId?: string | null;
        parentTaskId?: string | null;
        estimatePoints?: number | null;
        timeSpentMinutes?: number;
        dueAt?: Date | null;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      if (values.name !== undefined) updateValues.name = values.name;
      if (values.description !== undefined) {
        updateValues.description = values.description
          ? sanitizeRichText(values.description)
          : null;
      }
      if (values.status !== undefined) updateValues.status = values.status;
      if (values.priority !== undefined) updateValues.priority = values.priority;
      if (values.parentTaskId !== undefined) {
        if (values.parentTaskId) {
          await assertParentTask(
            db,
            activeOrganization.id,
            previousTask.projectId,
            values.parentTaskId,
            previousTask.id,
          );
        }
        updateValues.parentTaskId = values.parentTaskId;
      }
      if (values.estimatePoints !== undefined) {
        updateValues.estimatePoints = values.estimatePoints;
      }
      if (values.timeSpentMinutes !== undefined) {
        updateValues.timeSpentMinutes = values.timeSpentMinutes;
      }
      if (values.assignedToMemberId !== undefined) {
        updateValues.assignedToMemberId = values.assignedToMemberId;
      }
      if (values.dueAt !== undefined) updateValues.dueAt = values.dueAt;

      const changes = getChangedTaskFields(previousTask, values);

      const updatedTask = await db.transaction(async (tx) => {
        const [locked] = await tx
          .select({ status: tasks.status })
          .from(tasks)
          .where(
            and(
              eq(tasks.key, key),
              eq(tasks.organizationId, activeOrganization.id),
              isNull(tasks.deletedAt),
            ),
          )
          .for("update");
        const wasDone = locked?.status === "done";

        const completion =
          values.status === undefined
            ? {}
            : values.status === "done"
              ? wasDone
                ? {}
                : { completedAt: new Date() }
              : { completedAt: null };

        const [row] = await tx
          .update(tasks)
          .set({ ...updateValues, ...completion })
          .where(
            and(
              eq(tasks.key, key),
              eq(tasks.organizationId, activeOrganization.id),
              isNull(tasks.deletedAt),
            ),
          )
          .returning({ id: tasks.id });

        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found.",
          });
        }

        if (changes.length) {
          await recordTaskChanges(ctx, tx, previousTask, changes);
        } else {
          ctx.audit.skipped("task.updated");
        }

        if (values.status === "done" && !wasDone) {
          await triggerDownstreamUnblocks(ctx, tx, previousTask);
        }

        if (values.description !== undefined) {
          await syncMentions(tx, {
            organizationId: activeOrganization.id,
            memberId: (await getCurrentMember(ctx)).id,
            source: { type: "task", id: row.id },
            text: values.description,
            via: "description",
            mode: "replace",
          });
        }

        return row;
      });

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
          assignedToMemberId: tasks.assignedToMemberId,
          parentTaskId: tasks.parentTaskId,
          assignee: users.name,
          due: tasks.dueAt,
          completedAt: tasks.completedAt,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
        })
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .leftJoin(teams, eq(teams.id, tasks.teamId))
        .leftJoin(members, eq(members.id, tasks.assignedToMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(eq(tasks.id, updatedTask.id))
        .limit(1);

      if (task) {
        await notifyAndAutomateTaskUpdate(
          ctx,
          task,
          previousTask,
          values,
        );
      }

      return task;
    }),
};
