import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "@kyren/db/drizzle";
import { tasks } from "@kyren/db/schema";

import { memberName, postTaskEvent } from "../../chat-events";
import { runTaskAutomations } from "../../automations/engine";
import { type OrganizationContext } from "../../trpc";
import { getCurrentMember } from "../task-helpers";

/**
 * A parent must be a task in the same project, and a task can't become its own
 * ancestor. Ids from other projects or organizations read as "not found".
 */
export async function assertParentTask(
  db: OrganizationContext["db"],
  organizationId: string,
  projectId: string,
  parentTaskId: string,
  selfId?: string,
) {
  const invalid = new TRPCError({
    code: "BAD_REQUEST",
    message: "Pick a parent task from the same project.",
  });
  let cursor: string | null = parentTaskId;

  for (let depth = 0; cursor && depth < 50; depth += 1) {
    if (cursor === selfId) throw invalid;

    const [row] = await db
      .select({ projectId: tasks.projectId, parentTaskId: tasks.parentTaskId })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, cursor),
          eq(tasks.organizationId, organizationId),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);

    if (!row || row.projectId !== projectId) throw invalid;
    cursor = row.parentTaskId;
  }
}

export type TaskUpdateResult = {
  id: string;
  key: string;
  taskNumber: number;
  name: string;
  description: string | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  status: string;
  priority: string;
  assignedToMemberId: string | null;
  parentTaskId: string | null;
  assignee: string | null;
  due: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function notifyAndAutomateTaskUpdate(
  ctx: OrganizationContext,
  task: TaskUpdateResult,
  previousTask: {
    status: string;
    assignedToMemberId: string | null;
  },
  values: {
    status?: string;
    assignedToMemberId?: string | null;
  },
) {
  const { db, activeOrganization } = ctx;
  const actorForChat = await getCurrentMember(ctx);
  const chatTask = {
    id: task.id,
    key: task.key,
    name: task.name,
    projectId: task.projectId,
  };

  if (values.status === "done" && previousTask.status !== "done") {
    await postTaskEvent(db, {
      organizationId: activeOrganization.id,
      actorMemberId: actorForChat?.id ?? null,
      event: "done",
      task: chatTask,
    });
  }

  if (
    values.assignedToMemberId &&
    values.assignedToMemberId !== previousTask.assignedToMemberId
  ) {
    await postTaskEvent(db, {
      organizationId: activeOrganization.id,
      actorMemberId: actorForChat?.id ?? null,
      event: "assigned",
      task: chatTask,
      assigneeName: await memberName(db, values.assignedToMemberId),
    });
  }

  if (values.status && values.status !== previousTask.status) {
    const actor = await getCurrentMember(ctx);
    await runTaskAutomations({
      db,
      organizationId: activeOrganization.id,
      event: "task.status_changed",
      task: {
        id: task.id,
        key: task.key,
        status: task.status,
        projectId: task.projectId,
        parentTaskId: task.parentTaskId,
        assignedToMemberId: task.assignedToMemberId,
      },
      actorMemberId: actor?.id,
      previousStatus: previousTask.status,
    });

    if (task.parentTaskId && task.status === "done") {
      const siblingTasks = await db
        .select({ id: tasks.id, status: tasks.status })
        .from(tasks)
        .where(
          and(
            eq(tasks.parentTaskId, task.parentTaskId),
            isNull(tasks.deletedAt),
          ),
        );
      const allSiblingsDone = siblingTasks.every((t) => t.status === "done");
      if (allSiblingsDone) {
        await runTaskAutomations({
          db,
          organizationId: activeOrganization.id,
          event: "task.subtasks_all_done",
          task: {
            id: task.id,
            key: task.key,
            status: task.status,
            projectId: task.projectId,
            parentTaskId: task.parentTaskId,
            assignedToMemberId: task.assignedToMemberId,
          },
          actorMemberId: actor?.id,
        });
      }
    }
  }
}
