import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "@zentro/db/drizzle";
import {
  activityEvents,
  members,
  projects,
  tasks,
} from "@zentro/db/schema";

import {
  deleteTaskByKeySchema,
  logTaskTimeSchema,
} from "../../../types/zod-schema";
import { permissionProcedure } from "../../trpc";
import { taskByKey } from "../../resources";
import {
  addTimeLog,
  getCurrentMember,
  getTaskForActiveOrganization,
  triggerDownstreamUnblocks,
} from "../task-helpers";

export const taskLifecycleProcedures = {
  deleteTaskByKey: permissionProcedure("tasks.delete_own", taskByKey("key"), {
    module: "tasks",
    audit: ["task.deleted", "task.unblocked"],
  })
    .input(deleteTaskByKeySchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const task = await getTaskForActiveOrganization(ctx, input.key);
      const deletedTask = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(tasks)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tasks.id, task.id),
              eq(tasks.organizationId, activeOrganization.id),
              isNull(tasks.deletedAt),
            ),
          )
          .returning({ id: tasks.id, key: tasks.key });

        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found.",
          });
        }

        const detached = await tx
          .update(tasks)
          .set({ parentTaskId: null, updatedAt: new Date() })
          .where(
            and(
              eq(tasks.parentTaskId, task.id),
              eq(tasks.organizationId, activeOrganization.id),
            ),
          )
          .returning({ id: tasks.id });

        await ctx.audit.record(tx, {
          action: "task.deleted",
          target: { id: task.id, label: task.key },
          projectId: task.projectId,
          teamId: task.teamId,
          metadata: {
            name: task.name,
            ...(detached.length
              ? { detachedSubtaskIds: detached.map((r) => r.id) }
              : {}),
          },
        });

        await triggerDownstreamUnblocks(ctx, tx, task);

        return row;
      });

      return deletedTask;
    }),

  trash: permissionProcedure("tasks.view", undefined, {
    module: "tasks",
  }).query(async ({ ctx }) => {
    const anyProjects =
      await ctx.permissions.viewableProjectIds("tasks.delete_any");
    const seen = await ctx.permissions.viewableProjectIds("tasks.view");
    const member = await getCurrentMember(ctx);
    const reachable = or(
      anyProjects.length ? inArray(tasks.projectId, anyProjects) : undefined,
      seen.length
        ? and(
            inArray(tasks.projectId, seen),
            eq(tasks.createdByMemberId, member.id),
          )
        : undefined,
    );

    if (!reachable) return [];

    const rows = await ctx.db
      .select({
        key: tasks.key,
        name: tasks.name,
        deletedAt: tasks.deletedAt,
        projectId: tasks.projectId,
        teamId: tasks.teamId,
        projectName: projects.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(
        and(
          eq(tasks.organizationId, ctx.activeOrganization.id),
          isNotNull(tasks.deletedAt),
          isNull(projects.deletedAt),
          ne(projects.status, "archived"),
          reachable,
        ),
      )
      .orderBy(desc(tasks.deletedAt))
      .limit(100);

    const allowed = await Promise.all(
      rows.map(
        async (row) =>
          anyProjects.includes(row.projectId) ||
          (
            await ctx.permissions.check("tasks.delete_own", {
              projectId: row.projectId,
              teamId: row.teamId,
              ownerUserId: ctx.user.id,
            })
          ).allowed,
      ),
    );

    return rows
      .filter((_, index) => allowed[index])
      .map((row) => ({
        key: row.key,
        name: row.name,
        deletedAt: row.deletedAt,
        projectName: row.projectName,
      }));
  }),

  restoreByKey: permissionProcedure(
    "tasks.delete_own",
    taskByKey("key", { deleted: true }),
    { module: "tasks", audit: ["task.restored"] },
  )
    .input(deleteTaskByKeySchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(tasks)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(
            and(
              eq(tasks.key, input.key),
              eq(tasks.organizationId, activeOrganization.id),
              isNotNull(tasks.deletedAt),
              sql`exists (select 1 from ${projects} where ${projects.id} = ${tasks.projectId} and ${projects.deletedAt} is null)`,
            ),
          )
          .returning({
            id: tasks.id,
            key: tasks.key,
            name: tasks.name,
            projectId: tasks.projectId,
            teamId: tasks.teamId,
          });

        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "That task isn't in the trash.",
          });
        }

        const [deletion] = await tx
          .select({ metadata: activityEvents.metadata })
          .from(activityEvents)
          .where(
            and(
              eq(activityEvents.organizationId, activeOrganization.id),
              eq(activityEvents.action, "task.deleted"),
              eq(activityEvents.targetId, row.id),
            ),
          )
          .orderBy(desc(activityEvents.createdAt))
          .limit(1);
        const detachedIds = (
          deletion?.metadata as { detachedSubtaskIds?: unknown } | undefined
        )?.detachedSubtaskIds;

        if (Array.isArray(detachedIds) && detachedIds.length) {
          await tx
            .update(tasks)
            .set({ parentTaskId: row.id, updatedAt: new Date() })
            .where(
              and(
                inArray(tasks.id, detachedIds.map(String)),
                eq(tasks.organizationId, activeOrganization.id),
                eq(tasks.projectId, row.projectId),
                isNull(tasks.parentTaskId),
                isNull(tasks.deletedAt),
              ),
            );
        }

        await ctx.audit.record(tx, {
          action: "task.restored",
          target: { id: row.id, label: row.key },
          projectId: row.projectId,
          teamId: row.teamId,
          metadata: { name: row.name },
        });

        return { key: row.key };
      });
    }),

  logTime: permissionProcedure("tasks.update_own", taskByKey("key"), {
    module: "tasks",
  })
    .input(logTaskTimeSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization, user } = ctx;
      const { key, durationMinutes, note } = input;

      return await db.transaction(async (tx) => {
        const [task] = await tx
          .select({ id: tasks.id, timeSpentMinutes: tasks.timeSpentMinutes })
          .from(tasks)
          .where(
            and(
              eq(tasks.key, key),
              eq(tasks.organizationId, activeOrganization.id),
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

        const [member] = await tx
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.userId, user.id),
              eq(members.organizationId, activeOrganization.id),
            ),
          )
          .limit(1);

        return addTimeLog(tx, {
          organizationId: activeOrganization.id,
          taskId: task.id,
          memberId: member?.id ?? null,
          durationMinutes,
          note: note ?? null,
        });
      });
    }),
};
