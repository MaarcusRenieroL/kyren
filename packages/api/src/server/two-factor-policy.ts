import { eq } from "@kyren/db/drizzle";
import type { db as Database } from "@kyren/db";
import { organizations } from "@kyren/db/schema";

const ttlMs = 30_000;
const cache = new Map<string, { required: boolean; until: number }>();

/**
 * Whether an organization requires two-factor. Remembered for half a minute
 * per server so the check adds no query to most calls; changing the setting
 * clears it on the server that made the change.
 */
export async function requiresTwoFactor(
  db: typeof Database,
  organizationId: string,
) {
  const hit = cache.get(organizationId);

  if (hit && hit.until > Date.now()) return hit.required;

  const [row] = await db
    .select({ required: organizations.requireTwoFactor })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const required = row?.required ?? false;

  cache.set(organizationId, { required, until: Date.now() + ttlMs });

  return required;
}

export function forgetTwoFactorPolicy(organizationId: string) {
  cache.delete(organizationId);
}
