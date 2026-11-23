import { randomBytes } from "node:crypto";

import type { db as Database } from "@kyren/db";
import { and, eq, isNull } from "@kyren/db/drizzle";
import { docs, organizations } from "@kyren/db/schema";
import { sanitizeDocHtml } from "@kyren/utils";

import { loadEnabledModules } from "./modules";
import { organizationStatus } from "./platform-policy";

const TOKEN = /^[A-Za-z0-9_-]{32}$/;

/** A new secret for a doc's public link: 24 random bytes, URL-safe. */
export function newShareToken() {
  return randomBytes(24).toString("base64url");
}

/**
 * The read-only copy of a shared doc, or null. A link stops working the moment
 * sharing is turned off, the doc is trashed or archived, the organization is
 * suspended, or Docs is turned off there, exactly as if it never existed.
 */
export async function sharedDoc(db: typeof Database, token: string) {
  if (!TOKEN.test(token)) return null;

  const [row] = await db
    .select({
      title: docs.title,
      content: docs.content,
      updatedAt: docs.updatedAt,
      organizationId: docs.organizationId,
      organization: organizations.name,
    })
    .from(docs)
    .innerJoin(organizations, eq(organizations.id, docs.organizationId))
    .where(
      and(
        eq(docs.shareToken, token),
        isNull(docs.deletedAt),
        isNull(docs.archivedAt),
      ),
    )
    .limit(1);

  if (!row) return null;
  if ((await organizationStatus(db, row.organizationId)).suspended) return null;
  if (!(await loadEnabledModules(db, row.organizationId)).has("docs")) {
    return null;
  }

  return {
    title: row.title,
    html: sanitizeDocHtml(row.content),
    updatedAt: row.updatedAt,
    organization: row.organization,
  };
}
