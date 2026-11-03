export type TicketMail = {
  to: string;
  subject: string;
  body: string;
  /** Page in the app (the requester's private link). */
  path: string;
};

import type { db as database } from "@zentro/db";

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

  const { sendTicketReplyEmail } = await import("@zentro/auth");

  await sendTicketReplyEmail(mail);
}

registerJobHandler("ticket_mail", (payload) =>
  deliver(payload as unknown as TicketMail),
);

/**
 * Emails the requester an agent's reply. A failed send is logged and, when a
 * database is given, queued to be tried again: mail trouble must never lose the
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

  const mail: TicketMail = {
    to: ticket.requesterEmail,
    subject: `Re: ${ticket.subject} [SUP-${ticket.number}]`,
    body,
    path: `/support/${ticket.portalToken}`,
  };

  try {
    await deliver(mail);
  } catch (error) {
    console.error("[tickets] could not email the reply", error);

    if (db) {
      await enqueueJob(db, "ticket_mail", { ...mail }).catch(() => undefined);
    }
  }
}
