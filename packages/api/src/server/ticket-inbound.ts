import { and, eq, sql } from "@kyren/db/drizzle";
import {
  ticketInbound,
  ticketInboxes,
  ticketMessages,
  tickets,
} from "@kyren/db/schema";

import type { DbHandle } from "./access";
import { ticketsOpenToPublic } from "./tickets-public";
import { nextAssignee } from "./ticket-assignment";
import { mailTicketReceived } from "./ticket-mail";

export type InboundMail = {
  from: string;
  fromName?: string | null;
  subject: string;
  text: string;
  /** The mail's own id; a repeated delivery of the same id is ignored. */
  messageId?: string | null;
  /** The Auto-Submitted header, if the provider passes it on. */
  autoSubmitted?: string | null;
  /** The Precedence header; bulk and list mail opens a ticket but gets no reply. */
  precedence?: string | null;
};

type Tx = DbHandle & {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

type Db = DbHandle & {
  transaction: <T>(run: (tx: Tx) => Promise<T>) => Promise<T>;
};

export type InboundResult = {
  status: "created" | "replied" | "duplicate" | "ignored" | "unknown";
  /** The ticket the mail landed on, such as SUP-12. */
  ref?: string;
};

const ref = (number: number) => `SUP-${number}`;

/** Pulls the address out of "Name <a@b.c>" or a bare address; null when it is not one. */
function addressOf(from: string) {
  const match =
    /<([^<>\s]+@[^<>\s]+)>/.exec(from) ??
    /^([^\s<>]+@[^\s<>]+)$/.exec(from.trim());
  const address = match?.[1]?.trim().toLowerCase();

  return address && address.length <= 254 ? address : null;
}

/**
 * Turns an incoming email into a ticket, or into a reply on the ticket named
 * in its subject like "[SUP-12]". A reply only joins a ticket when it comes
 * from that ticket's own requester; anyone else opens a new ticket instead.
 * Mail naming a task key never comments on the task: a From address is not
 * proof of who sent it, so it cannot speak for a member.
 */
export async function receiveTicketMail(
  db: Db,
  token: string,
  mail: InboundMail,
): Promise<InboundResult> {
  const [inbox] = await db
    .select()
    .from(ticketInboxes)
    .where(eq(ticketInboxes.token, token))
    .limit(1);

  if (!inbox?.enabled) return { status: "unknown" };

  if (!(await ticketsOpenToPublic(db, inbox.organizationId))) {
    return { status: "unknown" };
  }

  // Out-of-office and bounce mail must not open tickets or start loops.
  if (mail.autoSubmitted && mail.autoSubmitted.toLowerCase() !== "no") {
    return { status: "ignored" };
  }

  const address = addressOf(mail.from);

  if (!address) return { status: "ignored" };

  const organizationId = inbox.organizationId;
  const subject = mail.subject.trim().slice(0, 200) || "(no subject)";
  const body = mail.text.trim().slice(0, 10_000);
  const name =
    mail.fromName?.trim().slice(0, 120) || address.split("@")[0]!.slice(0, 120);
  const threaded = /\[SUP-(\d{1,9})\]/i.exec(mail.subject);

  let createdTicket: Parameters<typeof mailTicketReceived>[0] | null = null;
  const result = await db.transaction(async (tx): Promise<InboundResult> => {
    // Serialize per organization: ticket numbers and the duplicate check.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`,
    );

    if (mail.messageId) {
      const [seen] = await tx
        .select({ id: ticketInbound.id })
        .from(ticketInbound)
        .where(
          and(
            eq(ticketInbound.organizationId, organizationId),
            eq(ticketInbound.messageId, mail.messageId.slice(0, 500)),
          ),
        )
        .limit(1);

      if (seen) return { status: "duplicate" };
    }

    let ticketId: string | null = null;
    let ticketRef = "";
    let status: "created" | "replied" = "created";

    if (threaded) {
      const [existing] = await tx
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.organizationId, organizationId),
            eq(tickets.number, Number(threaded[1])),
          ),
        )
        .limit(1);

      if (existing?.requesterEmail?.toLowerCase() === address) {
        await tx.insert(ticketMessages).values({
          ticketId: existing.id,
          organizationId,
          authorMemberId: null,
          kind: "inbound",
          body,
        });
        // The requester answered, so the ball is back with the team,
        // unless the ticket was marked spam.
        if (existing.status !== "spam") {
          await tx
            .update(tickets)
            .set({ status: "open", resolvedAt: null, updatedAt: new Date() })
            .where(eq(tickets.id, existing.id));
        }

        ticketId = existing.id;
        ticketRef = ref(existing.number);
        status = "replied";
      }
    }

    if (!ticketId) {
      const [last] = await tx
        .select({
          max: sql<number>`coalesce(max(${tickets.number}), 0)::int`,
        })
        .from(tickets)
        .where(eq(tickets.organizationId, organizationId));
      const number = (last?.max ?? 0) + 1;
      const [created] = await tx
        .insert(tickets)
        .values({
          organizationId,
          number,
          subject,
          description: body,
          requesterName: name,
          requesterEmail: address,
          assigneeMemberId: await nextAssignee(tx, organizationId),
        })
        .returning({
          id: tickets.id,
          number: tickets.number,
          subject: tickets.subject,
          requesterEmail: tickets.requesterEmail,
          portalToken: tickets.portalToken,
        });

      ticketId = created!.id;
      ticketRef = ref(number);
      createdTicket = created!;
    }

    if (mail.messageId) {
      await tx.insert(ticketInbound).values({
        organizationId,
        messageId: mail.messageId.slice(0, 500),
        ticketId,
      });
    }

    return { status, ref: ticketRef };
  });

  // After the ticket is saved: the sender learns it arrived and its reference.
  // Mailing lists and bulk senders are never answered automatically (RFC 3834).
  const bulk = /^(bulk|list|junk)$/i.test(mail.precedence?.trim() ?? "");

  if (createdTicket && !bulk) {
    await mailTicketReceived(createdTicket, "auto-replied", db as never);
  }

  return result;
}
