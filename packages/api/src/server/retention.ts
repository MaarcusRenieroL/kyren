import {
  and,
  eq,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from "@kyren/db/drizzle";
import {
  chatChannels,
  chatMessages,
  legalHolds,
  retentionPolicies,
  tickets,
} from "@kyren/db/schema";

import type { db as database } from "@kyren/db";

type Db = typeof database;

export const retentionTypes = ["chat_messages", "closed_tickets"] as const;
export type RetentionType = (typeof retentionTypes)[number];

const DAY = 86_400_000;

/** Organizations under a legal hold: nothing of theirs is purged. */
export async function heldOrganizationIds(db: Db) {
  return (
    await db.select({ id: legalHolds.organizationId }).from(legalHolds)
  ).map((row) => row.id);
}

export async function isUnderHold(db: Db, organizationId: string) {
  const [row] = await db
    .select({ id: legalHolds.organizationId })
    .from(legalHolds)
    .where(eq(legalHolds.organizationId, organizationId))
    .limit(1);

  return Boolean(row);
}

/** Deletes messages past a channel's retention window (pins are kept). */
export async function purgeExpired(db: Db) {
  const held = await heldOrganizationIds(db);
  const channels = await db
    .select({ id: chatChannels.id, days: chatChannels.retentionDays })
    .from(chatChannels)
    .where(
      and(
        sql`${chatChannels.retentionDays} is not null`,
        held.length ? notInArray(chatChannels.organizationId, held) : undefined,
      ),
    );
  let removed = 0;

  for (const channel of channels) {
    const rows = await db
      .delete(chatMessages)
      .where(
        and(
          eq(chatMessages.channelId, channel.id),
          isNull(chatMessages.pinnedAt),
          sql`${chatMessages.createdAt} < now() - (${channel.days} * interval '1 day')`,
        ),
      )
      .returning({ id: chatMessages.id });

    removed += rows.length;
  }

  return removed;
}

/**
 * Applies every organization's retention policies, then the channel-level
 * windows. Organizations under a legal hold are skipped entirely.
 */
export async function applyRetention(db: Db, now = new Date()) {
  const held = await heldOrganizationIds(db);
  const policies = await db
    .select()
    .from(retentionPolicies)
    .where(
      held.length
        ? notInArray(retentionPolicies.organizationId, held)
        : undefined,
    );
  let chat = 0;
  let closedTickets = 0;

  for (const policy of policies) {
    const cutoff = new Date(now.getTime() - policy.days * DAY);

    if (policy.dataType === "chat_messages") {
      const rows = await db
        .delete(chatMessages)
        .where(
          and(
            eq(chatMessages.organizationId, policy.organizationId),
            isNull(chatMessages.pinnedAt),
            lt(chatMessages.createdAt, cutoff),
          ),
        )
        .returning({ id: chatMessages.id });

      chat += rows.length;
    }

    if (policy.dataType === "closed_tickets") {
      const rows = await db
        .delete(tickets)
        .where(
          and(
            eq(tickets.organizationId, policy.organizationId),
            inArray(tickets.status, ["resolved", "spam"]),
            or(
              lt(tickets.resolvedAt, cutoff),
              and(isNull(tickets.resolvedAt), lt(tickets.updatedAt, cutoff)),
            ),
          ),
        )
        .returning({ id: tickets.id });

      closedTickets += rows.length;
    }
  }

  const channelWindows = await purgeExpired(db);

  return {
    chatMessages: chat + channelWindows,
    closedTickets,
  };
}
