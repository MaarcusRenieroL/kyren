import { meetingIcs } from "./ics";
import { Resend } from "resend";
import { authEnv } from "./env";
import { Invitation, Organization } from "better-auth/plugins";
import { User } from "better-auth";

import { escapeHtml } from "./html";

const resend = new Resend(authEnv.RESEND_API_KEY);

function getAppUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

export async function sendVerificationEmail(email: string, otp: string) {
  await resend.emails.send({
    from: authEnv.EMAIL_FROM,
    to: email,
    subject: "Verify your email",
    html: `
      <div style="background:#0a0a0a;padding:40px 20px;color:#e5e7eb;font-family: Inter, Arial, Sans-serif">
        <table style="
          max-width:560px;
          margin:auto;
          background:#111827;
          padding:40px;
          border-radius:16px;
        ">
          <tr>
            <td align="center">
              <h1>Verify your email</h1>

              <p>
                Use this verification code to complete setup.
              </p>

              <div style="
                padding:18px 28px;
                font-size:34px;
                letter-spacing:10px;
                font-weight:700;
              ">
                ${escapeHtml(otp)}
              </div>

              <p>This code will expire shortly.</p>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}

export async function sendForgotPasswordEmail(email: string, resetUrl: string) {
  await resend.emails.send({
    from: authEnv.EMAIL_FROM,
    to: email,
    subject: "Reset your password",
    html: `
      <div style="background:#0a0a0a;padding:40px 20px;color:#e5e7eb;font-family: Inter, Arial, Sans-serif">
        <table style="
          max-width:560px;
          margin:auto;
          background:#111827;
          padding:40px;
          border-radius:16px;
        ">
          <tr>
            <td align="center">
              <h1 style="margin:0 0 16px;color:#f9fafb;">
                Reset your password
              </h1>

              <p style="margin:0 0 24px;color:#d1d5db;line-height:1.5;">
                We received a request to reset your Zentro password.
                Click the button below to create a new password.
              </p>

              <a
                href="${escapeHtml(resetUrl)}"
                style="
                  display:inline-block;
                  background:#f9fafb;
                  color:#111827;
                  text-decoration:none;
                  padding:14px 22px;
                  border-radius:10px;
                  font-weight:700;
                  margin:8px 0 24px;
                "
              >
                Reset password
              </a>

              <p style="margin:0 0 12px;color:#9ca3af;font-size:14px;line-height:1.5;">
                If the button does not work, copy and paste this link into your browser:
              </p>

              <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.5;word-break:break-all;">
                <a href="${escapeHtml(resetUrl)}" style="color:#93c5fd;">
                  ${escapeHtml(resetUrl)}
                </a>
              </p>

              <p style="margin:24px 0 0;color:#9ca3af;font-size:14px;line-height:1.5;">
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}

export async function sendOrgInviteEmail(
  invitation: Invitation,
  organization: Organization,
  inviter: {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date;
    user: User;
  },
) {
  const appUrl = getAppUrl();

  const inviteUrl = `${appUrl}/auth/invite/${encodeURIComponent(
    invitation.id,
  )}`;

  const inviterName = inviter.user.name ?? inviter.user.email ?? "A teammate";
  const organizationName = organization.name;

  const role = invitation.role
    ? invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)
    : "Member";

  await resend.emails.send({
    from: authEnv.EMAIL_FROM,
    to: invitation.email,
    subject: `You're invited to join ${organizationName} on Zentro`,
    html: `
      <div style="background:#0a0a0a;padding:40px 20px;color:#e5e7eb;font-family: Inter, Arial, Sans-serif">
        <table style="
          max-width:560px;
          margin:auto;
          background:#111827;
          padding:40px;
          border-radius:16px;
        ">
          <tr>
            <td align="center">
              <h1 style="margin:0 0 16px;color:#f9fafb;">
                You're invited to join ${escapeHtml(organizationName)}
              </h1>

              <p style="margin:0 0 16px;color:#d1d5db;line-height:1.5;">
                ${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(organizationName)}</strong> on Zentro.
              </p>

              <p style="margin:0 0 24px;color:#d1d5db;line-height:1.5;">
                Your role will be <strong>${escapeHtml(role)}</strong>.
              </p>

              <a
                href="${escapeHtml(inviteUrl)}"
                style="
                  display:inline-block;
                  background:#f9fafb;
                  color:#111827;
                  text-decoration:none;
                  padding:14px 22px;
                  border-radius:10px;
                  font-weight:700;
                  margin:8px 0 24px;
                "
              >
                Accept invitation
              </a>

              <p style="margin:0 0 12px;color:#9ca3af;font-size:14px;line-height:1.5;">
                If the button does not work, copy and paste this link into your browser:
              </p>

              <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.5;word-break:break-all;">
                <a href="${escapeHtml(inviteUrl)}" style="color:#93c5fd;">
                  ${escapeHtml(inviteUrl)}
                </a>
              </p>

              <p style="margin:24px 0 0;color:#9ca3af;font-size:14px;line-height:1.5;">
                This invitation expires in 7 days. If you were not expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}

/** Tells someone their account was just used from a browser it has not used before. */
export async function sendNewSignInEmail(
  email: string,
  details: { browser: string; ip: string | null; when: Date },
) {
  await resend.emails.send({
    from: authEnv.EMAIL_FROM,
    to: email,
    subject: "New sign-in to your account",
    html: `
      <div style="background:#0a0a0a;padding:40px 20px;color:#e5e7eb;font-family: Inter, Arial, Sans-serif">
        <table style="max-width:560px;margin:auto;background:#111827;padding:40px;border-radius:16px;">
          <tr>
            <td>
              <h1>New sign-in</h1>
              <p>Your account was just signed in to from a browser we haven't seen before.</p>
              <p>
                <strong>When:</strong> ${escapeHtml(details.when.toUTCString())}<br />
                <strong>Browser:</strong> ${escapeHtml(details.browser.slice(0, 200))}<br />
                <strong>Address:</strong> ${escapeHtml(details.ip ?? "unknown")}
              </p>
              <p>If this was you, there is nothing to do. If it wasn't, <a href="${getAppUrl()}/auth/forgot-password" style="color:#93c5fd">reset your password</a> now and turn on two-factor sign-in.</p>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}

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
          uid: `${mail.path.split("/").pop()}@zentro`,
          method: mail.kind === "cancel" ? "CANCEL" : "REQUEST",
          title: mail.title,
          startsAt: mail.startsAt,
          durationMinutes: mail.durationMinutes,
          organizer: mail.organizer,
          // "Zentro <meet@example.com>" or a bare address.
          organizerEmail:
            /<([^>]+)>/.exec(authEnv.EMAIL_FROM)?.[1] ?? authEnv.EMAIL_FROM,
          attendeeEmail: mail.to,
          url,
        });

  await resend.emails.send({
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
  await resend.emails.send({
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
  await resend.emails.send({
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
