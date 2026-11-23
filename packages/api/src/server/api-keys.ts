import { createHash, randomBytes } from "node:crypto";

import { and, eq, isNull, or, gt, sql } from "@kyren/db/drizzle";
import type { db as Database } from "@kyren/db";
import { apiKeys, members, users } from "@kyren/db/schema";

const prefix = "zk_live_";

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** A new key and what to store for it. Show `key` once; keep `hash`. */
export function generateApiKey() {
  const key = `${prefix}${randomBytes(24).toString("base64url")}`;

  return { key, hash: hashApiKey(key), prefix: key.slice(0, 12) };
}

export type ApiKeyOwner = {
  keyId: string;
  organizationId: string;
  user: typeof users.$inferSelect;
};

/** The bearer token of a request, or null when there is none. */
export function bearerToken(headers: Headers) {
  const value = headers.get("authorization");
  const match = value?.match(/^Bearer\s+(\S+)$/i);

  return match?.[1] ?? null;
}

/**
 * Finds the person behind a key. Revoked, expired and unknown keys all return
 * null, as does a key whose owner has left the organization.
 */
export async function authenticateApiKey(
  db: typeof Database,
  token: string,
): Promise<ApiKeyOwner | null> {
  if (!token.startsWith(prefix) || token.length > 200) return null;

  const [row] = await db
    .select({ key: apiKeys, user: users })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.createdByUserId))
    .innerJoin(
      members,
      and(
        eq(members.userId, apiKeys.createdByUserId),
        eq(members.organizationId, apiKeys.organizationId),
      ),
    )
    .where(
      and(
        eq(apiKeys.keyHash, hashApiKey(token)),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, sql`now()`)),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Once a minute at most, so reads do not turn into writes.
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, row.key.id),
        or(
          isNull(apiKeys.lastUsedAt),
          sql`${apiKeys.lastUsedAt} < now() - interval '1 minute'`,
        ),
      ),
    );

  return {
    keyId: row.key.id,
    organizationId: row.key.organizationId,
    user: row.user,
  };
}
