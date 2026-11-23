import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "@zentro/db/drizzle";
import {
  members,
  projects,
  tasks,
  workLinks,
} from "@zentro/db/schema";
import { sanitizeRichText } from "@zentro/utils";

import { createTaskSchema } from "../../../types/zod-schema";
import { assertAnyPermission, permissionProcedure } from "../../trpc";
import { postTaskEvent } from "../../chat-events";
import { syncMentions } from "../../mentions";
import { readableMessage } from "../../chat";
import { resolveTarget } from "../link";
import { loadProjectById, projectFromInput } from "../../resources";
import { runTaskAutomations } from "../../automations/engine";
import { isUniqueViolation } from "../../db-errors";
import { assertParentTask } from "./helpers";

export const taskCreateProcedures = {
  createTask: permissionProcedure("tasks.create", projectFromInput, {
    module: "tasks",
    also: ["tasks.assign", "docs.view", "chat.view"],
    audit: ["task.created"],
  })
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;

      if (input.assignedToMemberId) {
        await assertAnyPermission(ctx, ["tasks.assign"], {
          project: (await loadProjectById(ctx, input.projectId)) ?? null,
        });
      }

      if (input.parentTaskId) {
        await assertParentTask(
          db,
          activeOrganization.id,
          input.projectId,
          input.parentTaskId,
        );
      }

      const linkDoc = input.linkDocId
        ? await resolveTarget(ctx, { type: "doc", id: input.linkDocId })
        : null;

      const linkMessage = input.linkMessageId
        ? await readableMessage(ctx, input.linkMessageId)
        : null;

      const create = () =>
        db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${input.projectId}, 0))`,
          );

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

          if (!member) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Member not found in active organization.",
            });
          }

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

          const [latestTask] = await tx
            .select({ taskNumber: tasks.taskNumber })
            .from(tasks)
            .where(eq(tasks.projectId, project.id))
            .orderBy(desc(tasks.taskNumber))
            .limit(1);

          const taskNumber = (latestTask?.taskNumber ?? 0) + 1;
          const key = `${project.taskKeyPrefix}-${taskNumber}`;
          let assignedToMemberId: string | null = null;

          if (input.assignedToMemberId) {
            const [assignee] = await tx
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

            assignedToMemberId = assignee.id;
          }

          const [task] = await tx
            .insert(tasks)
            .values({
              name: input.name,
              status: input.status,
              completedAt: input.status === "done" ? new Date() : null,
              priority: input.priority,
              dueAt: input.dueAt,
              estimatePoints: input.estimatePoints ?? null,
              projectId: project.id,
              parentTaskId: input.parentTaskId ?? null,
              teamId: project.teamId,
              description: input.description
                ? sanitizeRichText(input.description)
                : null,
              assignedToMemberId,
              createdByMemberId: member.id,
              organizationId: activeOrganization.id,
              key,
              taskNumber,
            })
            .returning();

          if (!task) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create task.",
            });
          }

          await ctx.audit.record(tx, {
            action: "task.created",
            target: { id: task.id, label: task.key },
            projectId: project.id,
            teamId: project.teamId,
            metadata: {
              name: task.name,
              ...(assignedToMemberId ? { assignedToMemberId } : {}),
              ...(linkDoc ? { linkedTo: linkDoc.label } : {}),
            },
          });

          if (linkMessage) {
            await tx.insert(workLinks).values({
              organizationId: activeOrganization.id,
              sourceType: "message",
              sourceId: linkMessage.id,
              targetType: "task",
              targetId: task.id,
              kind: "relates",
              createdByMemberId: member.id,
            });
          }

          if (linkDoc) {
            await tx.insert(workLinks).values({
              organizationId: activeOrganization.id,
              sourceType: "doc",
              sourceId: linkDoc.id,
              targetType: "task",
              targetId: task.id,
              kind: "relates",
              createdByMemberId: member.id,
            });
          }
          await syncMentions(tx, {
            organizationId: activeOrganization.id,
            memberId: member.id,
            source: { type: "task", id: task.id },
            text: task.description,
            via: "description",
            mode: "replace",
          });

          return task;
        });

      let created: Awaited<ReturnType<typeof create>>;

      try {
        created = await create();
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }

        created = await create();
      }

      await postTaskEvent(db, {
        organizationId: activeOrganization.id,
        actorMemberId: created.createdByMemberId,
        event: "created",
        task: {
          id: created.id,
          key: created.key,
          name: created.name,
          projectId: created.projectId,
        },
      });

      await runTaskAutomations({
        db,
        organizationId: activeOrganization.id,
        event: "task.created",
        task: {
          id: created.id,
          key: created.key,
          status: created.status,
          projectId: created.projectId,
          parentTaskId: created.parentTaskId,
          assignedToMemberId: created.assignedToMemberId,
          priority: created.priority,
        },
        actorMemberId: created.createdByMemberId,
      });

      return created;
    }),
};
