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

export function serializeActivityValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function getChangedTaskFields(
  previousTask: Task,
  values: {
    name?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    assignedToMemberId?: string | null;
    dueAt?: Date | null;
  },
) {
  const changes: Array<{
    field: string;
    fromValue: string | null;
    toValue: string | null;
  }> = [];

  const trackedFields = [
    ["name", previousTask.name, values.name],
    ["description", previousTask.description, values.description],
    ["status", previousTask.status, values.status],
    ["priority", previousTask.priority, values.priority],
    [
      "assignedToMemberId",
      previousTask.assignedToMemberId,
      values.assignedToMemberId,
    ],
    ["dueAt", previousTask.dueAt, values.dueAt],
  ] as const;

  for (const [field, previousValue, nextValue] of trackedFields) {
    if (nextValue === undefined) {
      continue;
    }

    const fromValue = serializeActivityValue(previousValue);
    const toValue = serializeActivityValue(nextValue);

    if (fromValue !== toValue) {
      changes.push({ field, fromValue, toValue });
    }
  }

  return changes;
}

async function memberName(
  handle: Pick<TRPCContext["db"], "select">,
  id: string | null,
) {
  if (!id) {
    return null;
  }

  const [row] = await handle
    .select({ name: users.name, email: users.email })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.id, id))
    .limit(1);

  return row ? row.name || row.email : null;
}

/**
 * Records what an update changed: a status change, an assignment change and
 * the remaining field edits are separate events, so each reads on its own.
 */
export async function recordTaskChanges(
  ctx: TRPCContext,
  tx: AuditHandle & Pick<TRPCContext["db"], "select">,
  task: Pick<Task, "id" | "key" | "name" | "projectId" | "teamId">,
  changes: Array<{
    field: string;
    fromValue: string | null;
    toValue: string | null;
  }>,
) {
  const target = { id: task.id, label: task.key };
  const scope = { projectId: task.projectId, teamId: task.teamId };
  const common = { target, ...scope, metadata: { name: task.name } };
  const status = changes.find((change) => change.field === "status");
  const assignee = changes.find(
    (change) => change.field === "assignedToMemberId",
  );
  const others = changes.filter(
    (change) => change !== status && change !== assignee,
  );

  if (status) {
    await ctx.audit.record(tx, {
      action: "task.status_changed",
      ...common,
      changes: [
        { field: "status", from: status.fromValue, to: status.toValue },
      ],
    });
  }

  if (assignee) {
    await ctx.audit.record(tx, {
      action: "task.assigned",
      ...common,
      // The new assignee's member id, so their inbox can find this event.
      metadata: { ...common.metadata, assignedToMemberId: assignee.toValue },
      changes: [
        {
          field: "assignee",
          from: await memberName(tx, assignee.fromValue),
          to: await memberName(tx, assignee.toValue),
        },
      ],
    });
  }

  if (others.length) {
    await ctx.audit.record(tx, {
      action: "task.updated",
      ...common,
      changes: others.map((change) => ({
        field: change.field,
        from: change.fromValue,
        to: change.toValue,
      })),
    });
  }
}

/**
 * When a task is completed or deleted, any downstream task it was blocking that
 * now has zero open blockers left is considered unblocked. We emit a
 * `task.unblocked` audit event so the assignee receives an inbox notification.
 */
