import { db } from "@kyren/db";
import { emailSuppressions } from "@kyren/db/schema";

import { verifySignature } from "../../../../lib/webhook-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailEvent = {
  type?: string;
  data?: { to?: string[] | string; bounce?: { type?: string } };
};

/**
 * Bounces and spam complaints from the email provider. A hard bounce or a
 * complaint puts the address on the suppression list; Kyren stops mailing it.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const body = await request.text();

  if (!secret || !verifySignature(secret, request.headers, body)) {
    return new Response(null, { status: 401 });
  }

  let event: EmailEvent;

  try {
    event = JSON.parse(body) as EmailEvent;
  } catch {
    return new Response(null, { status: 400 });
  }

  const hardBounce =
    event.type === "email.bounced" &&
    (event.data?.bounce?.type ?? "Permanent").toLowerCase() !== "transient";
  const reason =
    event.type === "email.complained"
      ? "complained"
      : hardBounce
        ? "bounced"
        : null;

  if (reason) {
    const to = event.data?.to ?? [];
    const addresses = (Array.isArray(to) ? to : [to])
      .filter((address) => typeof address === "string" && address.includes("@"))
      .map((address) => address.toLowerCase());

    if (addresses.length) {
      await db
        .insert(emailSuppressions)
        .values(addresses.map((email) => ({ email, reason })))
        .onConflictDoNothing();
    }
  }

  return new Response(null, { status: 204 });
}
