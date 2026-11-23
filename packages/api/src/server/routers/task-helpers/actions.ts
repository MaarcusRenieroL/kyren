import { TRPCError } from "@trpc/server";
import { and, count, eq, isNull, ne, sql } from "@zentro/db/drizzle";
import {
  members,
  taskTimeLogs,
  tasks,
  users,
  workLinks,
  type Task,
} from "@zentro/db/schema";
import type { AuditHandle } from "@zentro/audit/server";
import type { TRPCContext } from "../../../types";
import { runTaskAutomations } from "../../automations/engine";

export async function triggerDownstreamUnblocks(
  ctx: TRPCContext,
  tx: AuditHandle & Pick<TRPCContext["db"], "select">,
  completedTask: { id: string; key: string; name: string },
) {
  const { activeOrganization } = ctx;

  if (!activeOrganization?.id) return;

  const orgId = activeOrganization.id;

  const blockedLinks = await tx
    .select({
      targetId: workLinks.targetId,
    })
    .from(workLinks)
    .where(
      and(
        eq(workLinks.organizationId, orgId),
        eq(workLinks.sourceType, "task"),
        eq(workLinks.sourceId, completedTask.id),
        eq(workLinks.targetType, "task"),
        eq(workLinks.kind, "blocks"),
      ),
    );

  if (!blockedLinks.length) return;

  for (const link of blockedLinks) {
    const [targetTask] = await tx
      .select({
        id: tasks.id,
        key: tasks.key,
        name: tasks.name,
        status: tasks.status,
        projectId: tasks.projectId,
        teamId: tasks.teamId,
        assignedToMemberId: tasks.assignedToMemberId,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, link.targetId),
          eq(tasks.organizationId, orgId),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);

    if (!targetTask || targetTask.status === "done") continue;

    const [remaining] = await tx
      .select({ count: count() })
      .from(workLinks)
      .innerJoin(tasks, eq(tasks.id, workLinks.sourceId))
      .where(
        and(
          eq(workLinks.organizationId, orgId),
          eq(workLinks.targetType, "task"),
          eq(workLinks.targetId, targetTask.id),
          eq(workLinks.kind, "blocks"),
          eq(workLinks.sourceType, "task"),
          ne(tasks.id, completedTask.id),
          ne(tasks.status, "done"),
          isNull(tasks.deletedAt),
        ),
      );

    if ((remaining?.count ?? 0) === 0) {
      await ctx.audit.record(tx, {
        action: "task.unblocked",
        target: { id: targetTask.id, label: targetTask.key },
        projectId: targetTask.projectId,
        teamId: targetTask.teamId,
        metadata: {
          name: targetTask.name,
          assignedToMemberId: targetTask.assignedToMemberId,
          unblockedByTaskKey: completedTask.key,
          unblockedByTaskName: completedTask.name,
        },
      });
      await runTaskAutomations({
        db: tx,
        organizationId: orgId,
        event: "task.blockers_resolved",
        task: {
          id: targetTask.id,
          key: targetTask.key,
          status: targetTask.status,
          projectId: targetTask.projectId,
          assignedToMemberId: targetTask.assignedToMemberId,
        },
      });
    }
  }
}

/**
 * Adds a time log to a task and its running total. The total is added in SQL
 * so two entries logged at once both count.
 */
export async function addTimeLog(
  tx: Pick<TRPCContext["db"], "insert" | "update">,
  input: {
    organizationId: string;
    taskId: string;
    memberId: string | null;
    durationMinutes: number;
    note: string | null;
  },
) {
  const [log] = await tx.insert(taskTimeLogs).values(input).returning();

  if (!log) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create time log entry.",
    });
  }

  const [updated] = await tx
    .update(tasks)
    .set({
      timeSpentMinutes: sql`coalesce(${tasks.timeSpentMinutes}, 0) + ${input.durationMinutes}`,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, input.taskId))
    .returning({ total: tasks.timeSpentMinutes });

  return { log, totalTimeSpentMinutes: updated?.total ?? 0 };
}
