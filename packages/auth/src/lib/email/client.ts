import { Resend } from "resend";
import { authEnv } from "../env";
import { db } from "@zentro/db";
import { inArray } from "@zentro/db/drizzle";
import { emailSuppressions } from "@zentro/db/schema";

export const resend = new Resend(authEnv.RESEND_API_KEY);

export type Message = Parameters<typeof resend.emails.send>[0];

/**
 * Sends through Resend, except to addresses that bounced or reported spam
 * (see the email events webhook): mailing them again harms deliverability.
 */
export async function send(message: Message) {
  const recipients = (
    Array.isArray(message.to) ? message.to : [message.to]
  ).map((address) => address.toLowerCase());
  const blocked = await db
    .select({ email: emailSuppressions.email })
    .from(emailSuppressions)
    .where(inArray(emailSuppressions.email, recipients));

  if (blocked.length === recipients.length) {
    console.warn(
      JSON.stringify({ level: "warn", scope: "email", skipped: "suppressed" }),
    );
    return;
  }

  const allowed = recipients.filter(
    (address) => !blocked.some((row) => row.email === address),
  );

  await resend.emails.send({ ...message, to: allowed } as Message);
}

export function getAppUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}
