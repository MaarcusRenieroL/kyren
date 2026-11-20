import { createHmac, timingSafeEqual } from "node:crypto";

/** A signed event older than this is refused, so it can't be replayed. */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Resend's webhook signature (Svix format): an HMAC-SHA256 of
 * "id.timestamp.body" with the endpoint secret, in `svix-signature` as
 * space-separated "v1,<base64>" entries.
 */
export function verifySignature(
  secret: string,
  headers: Headers,
  body: string,
  now = Date.now(),
) {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");

  if (!id || !timestamp || !signatures) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();

  return signatures.split(" ").some((entry) => {
    const [version, value] = entry.split(",");

    if (version !== "v1" || !value) return false;

    const given = Buffer.from(value, "base64");

    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
