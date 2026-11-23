import type { Invitation, Organization } from "better-auth/plugins";
import type { User } from "better-auth";
import { authEnv } from "../env";
import { escapeHtml } from "../html";
import { getAppUrl, send } from "./client";

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

  await send({
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
