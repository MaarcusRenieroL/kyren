import { authEnv } from "../env";
import { escapeHtml } from "../html";
import { meetingIcs } from "../ics";
import { getAppUrl, send } from "./client";

/** "Wed 18 Nov 2026, 14:30 UTC": plain about which clock it is. */
function utcLabel(date: Date) {
  return `${new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

const meetingHeadlines = {
  invite: "You're invited to a meeting",
  cancel: "A meeting was canceled",
  reminder: "A meeting starts soon",
} as const;

/** Invitation, cancellation and starting-soon notices for a meeting. Links to the app, never to the video room. */
export async function sendMeetingEmail(mail: {
  kind: keyof typeof meetingHeadlines;
  to: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  organizer: string;
  path: string;
}) {
  const headline = meetingHeadlines[mail.kind];
  const url = `${getAppUrl()}${mail.path}`;
  // Invites and cancellations carry a calendar file: it shows the reader's own
  // time and adds (or removes) the meeting in their calendar app.
  const invite =
    mail.kind === "reminder"
      ? null
      : meetingIcs({
          uid: `${mail.path.split("/").pop()}@kyren`,
          method: mail.kind === "cancel" ? "CANCEL" : "REQUEST",
          title: mail.title,
          startsAt: mail.startsAt,
          durationMinutes: mail.durationMinutes,
          organizer: mail.organizer,
          // "Kyren <meet@example.com>" or a bare address.
          organizerEmail:
            /<([^>]+)>/.exec(authEnv.EMAIL_FROM)?.[1] ?? authEnv.EMAIL_FROM,
          attendeeEmail: mail.to,
          url,
        });

  await send({
    from: authEnv.EMAIL_FROM,
    to: mail.to,
    subject: `${headline}: ${mail.title.slice(0, 120)}`,
    ...(invite
      ? {
          attachments: [
            {
              filename: mail.kind === "cancel" ? "cancel.ics" : "invite.ics",
              content: Buffer.from(invite),
              contentType: `text/calendar; method=${mail.kind === "cancel" ? "CANCEL" : "REQUEST"}`,
            },
          ],
        }
      : {}),
    html: `
      <div style="background:#0a0a0a;padding:40px 20px;color:#e5e7eb;font-family: Inter, Arial, Sans-serif">
        <table style="max-width:560px;margin:auto;background:#111827;padding:40px;border-radius:16px;">
          <tr>
            <td>
              <h1>${escapeHtml(headline)}</h1>
              <p><strong>${escapeHtml(mail.title)}</strong></p>
              <p>
                <strong>When:</strong> ${escapeHtml(utcLabel(mail.startsAt))} (${mail.durationMinutes} min)${invite ? " &middot; the attached invite shows your local time" : ""}<br />
                <strong>Organizer:</strong> ${escapeHtml(mail.organizer)}
              </p>
              ${
                mail.kind === "cancel"
                  ? ""
                  : `<p><a href="${getAppUrl()}${escapeHtml(mail.path)}" style="color:#93c5fd">Open the meeting</a> to answer, read the agenda and join the call.</p>`
              }
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}

/** Someone was mentioned in a conversation they haven't read since. */
export async function sendChatMentionEmail(mail: {
  to: string;
  author: string;
  conversation: string;
  excerpt: string;
  path: string;
}) {
  await send({
    from: authEnv.EMAIL_FROM,
    to: mail.to,
    subject: `${mail.author} mentioned you in ${mail.conversation}`.slice(
      0,
      200,
    ),
    headers: { "Auto-Submitted": "auto-generated" },
    html: `
      <div style="background:#0a0a0a;padding:40px 20px;color:#e5e7eb;font-family: Inter, Arial, Sans-serif">
        <table style="max-width:560px;margin:auto;background:#111827;padding:40px;border-radius:16px;">
          <tr>
            <td>
              <p><strong>${escapeHtml(mail.author)}</strong> mentioned you in ${escapeHtml(mail.conversation)}:</p>
              <p style="white-space:pre-wrap;border-left:3px solid #374151;padding-left:12px;color:#d1d5db">${escapeHtml(mail.excerpt)}</p>
              <p><a href="${getAppUrl()}${escapeHtml(mail.path)}" style="color:#93c5fd">Open the conversation</a></p>
              <p style="color:#9ca3af;font-size:12px">You can turn these emails off in your notification settings.</p>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}

/** An agent's reply to a requester, with a private link to follow and answer the ticket. */
export async function sendTicketReplyEmail(mail: {
  to: string;
  subject: string;
  body: string;
  path: string;
  autoSubmitted?: "auto-replied" | "auto-generated";
}) {
  await send({
    from: authEnv.EMAIL_FROM,
    to: mail.to,
    subject: mail.subject.slice(0, 200),
    // RFC 3834: autoresponders must not answer automatic mail.
    ...(mail.autoSubmitted
      ? { headers: { "Auto-Submitted": mail.autoSubmitted } }
      : {}),
    html: `
      <div style="background:#0a0a0a;padding:40px 20px;color:#e5e7eb;font-family: Inter, Arial, Sans-serif">
        <table style="max-width:560px;margin:auto;background:#111827;padding:40px;border-radius:16px;">
          <tr>
            <td>
              <p style="white-space:pre-wrap">${escapeHtml(mail.body)}</p>
              <p style="color:#9ca3af;font-size:14px">
                You can reply to this email, or <a href="${getAppUrl()}${escapeHtml(mail.path)}" style="color:#93c5fd">open your request</a> to see the whole conversation.
                Keep the reference in the subject so your answer reaches the right ticket.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}
