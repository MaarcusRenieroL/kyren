import { eq } from "@zentro/db/drizzle";
import type { db as Database } from "@zentro/db";
import { ipAllowlist, organizations } from "@zentro/db/schema";

/** An address as 4 or 16 bytes' worth of bits, or null when it is not an address. */
function parseIp(raw: string): { bits: bigint; size: 32 | 128 } | null {
  let text = raw.trim().toLowerCase();

  if (text.startsWith("::ffff:") && text.includes(".")) {
    text = text.slice(7);
  }

  if (text.includes(".") && !text.includes(":")) {
    const parts = text.split(".");

    if (parts.length !== 4) return null;

    let bits = 0n;

    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;

      bits = (bits << 8n) | BigInt(part);
    }

    return { bits, size: 32 };
  }

  if (!text.includes(":")) return null;

  const halves = text.split("::");

  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;

  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [
    ...head,
    ...Array(halves.length === 2 ? missing : 0).fill("0"),
    ...tail,
  ];

  if (groups.length !== 8) return null;

  let bits = 0n;

  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;

    bits = (bits << 16n) | BigInt(`0x${group}`);
  }

  return { bits, size: 128 };
}

/** Whether `ip` falls inside `cidr` (a range like 203.0.113.0/24, or one address). */
export function ipMatches(ip: string, cidr: string) {
  const [base, prefixText] = cidr.split("/");
  const address = parseIp(ip);
  const range = base ? parseIp(base) : null;

  if (!address || !range || address.size !== range.size) return false;

  let prefix: number = range.size;

  if (prefixText !== undefined) {
    if (!/^\d{1,3}$/.test(prefixText)) return false;

    prefix = Number(prefixText);

    if (prefix > range.size) return false;
  }

  const shift = BigInt(range.size - prefix);

  return address.bits >> shift === range.bits >> shift;
}

/** Whether the text is a valid address or range. */
export function isValidCidr(cidr: string) {
  const [base, prefixText] = cidr.split("/");
  const range = base ? parseIp(base) : null;

  if (!range) return false;

  return (
    prefixText === undefined ||
    (/^\d{1,3}$/.test(prefixText) && Number(prefixText) <= range.size)
  );
}

const ttlMs = 30_000;
const cache = new Map<
  string,
  { enabled: boolean; ranges: string[]; until: number }
>();

async function policy(db: typeof Database, organizationId: string) {
  const hit = cache.get(organizationId);

  if (hit && hit.until > Date.now()) return hit;

  const [org] = await db
    .select({ enabled: organizations.ipAllowlistEnabled })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const ranges = org?.enabled
    ? (
        await db
          .select({ cidr: ipAllowlist.cidr })
          .from(ipAllowlist)
          .where(eq(ipAllowlist.organizationId, organizationId))
      ).map((row) => row.cidr)
    : [];
  const entry = {
    enabled: org?.enabled ?? false,
    ranges,
    until: Date.now() + ttlMs,
  };

  cache.set(organizationId, entry);

  return entry;
}

/**
 * Whether a request from `ip` may use the organization. Everyone may when the
 * allow-list is off. Remembered for half a minute per server; changing the
 * list clears it on the server that made the change.
 */
export async function ipAllowed(
  db: typeof Database,
  organizationId: string,
  ip: string | null,
) {
  const rules = await policy(db, organizationId);

  if (!rules.enabled) return true;

  return ip !== null && rules.ranges.some((range) => ipMatches(ip, range));
}

export function forgetIpPolicy(organizationId: string) {
  cache.delete(organizationId);
}
