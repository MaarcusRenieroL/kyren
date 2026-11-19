import { hit, receiveTicketMail } from "@zentro/api/server";
import { maintenanceResponse } from "~/src/lib/maintenance";
import { db } from "@zentro/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";

/** Crude but safe: tags out, so an HTML-only email still yields readable text. */
const stripHtml = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Email to ticket. A mail provider (Resend, Postmark, Mailgun, a forwarding
 * rule) posts each incoming message here as JSON:
 * { from, fromName?, subject, text | html, messageId?, autoSubmitted?, precedence? }.
 * The token in the address is the secret, so it is never logged.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const paused = await maintenanceResponse();

  if (paused) return paused;

  if (!/^[0-9a-f]{48}$/.test(token)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);

  if (declared > MAX_BODY_BYTES) {
    return Response.json({ error: "Too large" }, { status: 413 });
  }

  const limit = await hit(db, `inbound-tickets:${token}`, {
    max: 120,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "retry-after": String(limit.retryAfterSeconds) },
      },
    );
  }

  const raw = await request.text();

  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Too large" }, { status: 413 });
  }

  let body: Record<string, unknown>;

  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const html = text(body.html, 200_000);
  const result = await receiveTicketMail(
    db as unknown as Parameters<typeof receiveTicketMail>[0],
    token,
    {
      from: text(body.from, 500),
      fromName: text(body.fromName, 200) || null,
      subject: text(body.subject, 1000),
      text: text(body.text, 100_000) || (html ? stripHtml(html) : ""),
      messageId: text(body.messageId, 500) || null,
      autoSubmitted: text(body.autoSubmitted, 100) || null,
      precedence: text(body.precedence, 40) || null,
    },
  );

  if (result.status === "unknown") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Providers retry on errors, so every handled outcome is a plain 200.
  return Response.json({ status: result.status, ref: result.ref ?? null });
}
