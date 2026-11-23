export type TicketMail = {
  to: string;
  subject: string;
  body: string;
  /** Page in the app (the requester's private link). */
  path: string;
  /**
   * Set when the system sends it, not a person, so autoresponders stay quiet
   * (RFC 3834): "auto-replied" answers mail, "auto-generated" answers a form.
   */
  autoSubmitted?: "auto-replied" | "auto-generated";
};

import type { db as database } from "@kyren/db";

import { hit } from "@kyren/db/rate-limit";

import { enqueueJob, registerJobHandler } from "./jobs";

type Mailer = (mail: TicketMail) => Promise<void>;

let override: Mailer | null = null;

/** Replaces how mail is sent (tests); null goes back to the real thing. */
export function setTicketMailer(mailer: Mailer | null) {
  override = mailer;
}

async function deliver(mail: TicketMail) {
  if (override) {
    await override(mail);

    return;
  }

  // Reserved test addresses never receive real mail.
  if (mail.to.toLowerCase().endsWith(".test")) return;

  const { sendTicketReplyEmail } = await import("@kyren/auth");

  await sendTicketReplyEmail(mail);
}

registerJobHandler("ticket_mail", (payload) =>
  deliver(payload as unknown as TicketMail),
);

/** Sends now; on failure logs and, when a database is given, queues a retry. */
async function deliverOrQueue(
  mail: TicketMail,
  what: string,
  db?: typeof database,
) {
  try {
    await deliver(mail);
  } catch (error) {
    console.error(`[tickets] could not email the ${what}`, error);

    if (db) {
      await enqueueJob(db, "ticket_mail", { ...mail }).catch(() => undefined);
    }
  }
}

/**
 * Emails the requester an agent's reply. Mail trouble must never lose the
 * reply, which is already saved.
 */
export async function mailTicketReply(
  ticket: {
    number: number;
    subject: string;
    requesterEmail: string | null;
    portalToken: string;
  },
  body: string,
  db?: typeof database,
) {
  if (!ticket.requesterEmail) return;

  await deliverOrQueue(
    {
      to: ticket.requesterEmail,
      subject: `Re: ${ticket.subject} [SUP-${ticket.number}]`,
      body,
      path: `/support/${ticket.portalToken}`,
    },
    "reply",
    db,
  );
}

/** Acknowledgements one address can receive per hour. */
const ACKS_PER_HOUR = 3;

/**
 * Tells someone who wrote in that their request arrived, with its reference
 * and their private link. Anyone can type any address into a public form, so
 * the mail repeats nothing they wrote and each address gets a few per hour at
 * most: it can't be used to send spam from this domain.
 */
export async function mailTicketReceived(
  ticket: {
    number: number;
    requesterEmail: string | null;
    portalToken: string;
  },
  autoSubmitted: "auto-replied" | "auto-generated",
  db: typeof database,
) {
  if (!ticket.requesterEmail) return;

  const { allowed } = await hit(
    db,
    `ticket-ack:${ticket.requesterEmail.toLowerCase()}`,
    { max: ACKS_PER_HOUR, windowMs: 3_600_000 },
  );

  if (!allowed) return;

  await deliverOrQueue(
    {
      to: ticket.requesterEmail,
      subject: `We received your request [SUP-${ticket.number}]`,
      body: `Thanks for getting in touch. Your request is logged as SUP-${ticket.number}, and someone from the team will reply here.`,
      path: `/support/${ticket.portalToken}`,
      autoSubmitted,
    },
    "acknowledgement",
    db,
  );
}
