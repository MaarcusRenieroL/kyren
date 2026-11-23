import { and, asc, eq, inArray, sql } from "@kyren/db/drizzle";
import { ticketMessages, tickets } from "@kyren/db/schema";

import type { DbHandle } from "./access";
import { ticketsOpenToPublic } from "./tickets-public";

type Tx = DbHandle & {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

type Db = DbHandle & {
  transaction: <T>(run: (tx: Tx) => Promise<T>) => Promise<T>;
};

const TOKEN = /^[0-9a-f]{64}$/;

/**
 * What a requester sees through their private link: the subject, the status
 * and the conversation, without internal notes, people, priority or SLAs.
 */
export async function portalView(db: DbHandle, token: string) {
  if (!TOKEN.test(token)) return null;

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.portalToken, token))
    .limit(1);

  if (!ticket || !(await ticketsOpenToPublic(db, ticket.organizationId))) {
    return null;
  }

  const messages = await db
    .select({
      kind: ticketMessages.kind,
      body: ticketMessages.body,
      at: ticketMessages.createdAt,
    })
    .from(ticketMessages)
    .where(
      and(
        eq(ticketMessages.ticketId, ticket.id),
        inArray(ticketMessages.kind, ["reply", "inbound"]),
      ),
    )
    .orderBy(asc(ticketMessages.createdAt));

  return {
    ref: `SUP-${ticket.number}`,
    subject: ticket.subject,
    status: ticket.status,
    messages: [
      ...(ticket.description
        ? [
            {
              from: "you" as const,
              body: ticket.description,
              at: ticket.createdAt.toISOString(),
            },
          ]
        : []),
      ...messages.map((m) => ({
        from: (m.kind === "inbound" ? "you" : "team") as "you" | "team",
        body: m.body,
        at: m.at.toISOString(),
      })),
    ].map(({ body, from, at }) => ({ body, from, at })),
  };
}

/** The requester's answer through the link. It reopens the ticket for the team. */
export async function portalReply(
  db: Db,
  token: string,
  text: string,
): Promise<{ ok: boolean }> {
  const body = text.trim().slice(0, 10_000);

  if (!TOKEN.test(token) || !body) return { ok: false };

  return db.transaction(async (tx) => {
    const [ticket] = await tx
      .select({
        id: tickets.id,
        organizationId: tickets.organizationId,
        status: tickets.status,
      })
      .from(tickets)
      .where(eq(tickets.portalToken, token))
      .limit(1);

    if (!ticket || !(await ticketsOpenToPublic(tx, ticket.organizationId))) {
      return { ok: false };
    }

    await tx.insert(ticketMessages).values({
      ticketId: ticket.id,
      organizationId: ticket.organizationId,
      authorMemberId: null,
      kind: "inbound",
      body,
    });
    // A reply reopens the ticket for the team, unless it was marked spam.
    if (ticket.status !== "spam") {
      await tx
        .update(tickets)
        .set({ status: "open", resolvedAt: null, updatedAt: new Date() })
        .where(eq(tickets.id, ticket.id));
    }

    return { ok: true };
  });
}
