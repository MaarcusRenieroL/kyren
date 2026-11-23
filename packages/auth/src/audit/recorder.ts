import { randomUUID } from "node:crypto";
import {
  insertActivityEvent,
  requestContextFromHeaders,
} from "@kyren/audit/server";
import { db } from "@kyren/db";
import { eq, sql } from "@kyren/db/drizzle";
import { members, users } from "@kyren/db/schema";
import type { HookContext } from "./types";

export async function organizationsOf(userId: string) {
  const rows = await db
    .select({ organizationId: members.organizationId })
    .from(members)
    .where(eq(members.userId, userId));

  return rows.map((row) => row.organizationId);
}

export async function userByEmail(email: unknown) {
  if (typeof email !== "string" || !email) {
    return null;
  }

  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  return row ?? null;
}

/** Writes one event into every organization the user belongs to. */
export async function recordForUser(
  ctx: Pick<HookContext, "headers">,
  userId: string,
  action: string,
  options: { label?: string | null; metadata?: Record<string, unknown> } = {},
) {
  try {
    const request = requestContextFromHeaders(ctx.headers, randomUUID());
    const [user] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    for (const organizationId of await organizationsOf(userId)) {
      await insertActivityEvent(db, {
        organizationId,
        actorUserId: userId,
        action,
        target: {
          id: userId,
          label: options.label ?? (user ? user.name || user.email : null),
        },
        metadata: options.metadata,
        request,
      });
    }
  } catch (error) {
    // Auditing must never break signing in or out.
    console.error(`[audit] could not record ${action}`, error);
  }
}

/** Writes one event into a single organization (membership events). */
export async function recordInOrganization(
  ctx: Pick<HookContext, "headers">,
  input: {
    organizationId: string;
    actorUserId: string | null;
    action: string;
    targetId: string;
    label?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await insertActivityEvent(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      target: { id: input.targetId, label: input.label },
      metadata: input.metadata,
      request: requestContextFromHeaders(ctx.headers, randomUUID()),
    });
  } catch (error) {
    console.error(`[audit] could not record ${input.action}`, error);
  }
}
