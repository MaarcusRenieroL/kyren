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

export async function getCurrentMember(ctx: TRPCContext) {
  const { db, user, activeOrganization } = ctx;

  if (!user?.id || !activeOrganization?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
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

  return member;
}

export async function getTaskForActiveOrganization(
  ctx: TRPCContext,
  key: string,
) {
  const { db, activeOrganization } = ctx;

  if (!activeOrganization?.id) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active organization selected",
    });
  }

  const [task] = await db
    .select()
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

  return task;
}

