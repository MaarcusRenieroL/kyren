import { and, eq, isNotNull, lte } from "@zentro/db/drizzle";
import type { db as Database } from "@zentro/db";
import { files, organizations, platformAuditEvents } from "@zentro/db/schema";

import { reportError } from "./error-report";
import { SYSTEM_ACTOR_ID } from "./platform-audit";

/**
 * Deletes organizations whose grace period has ended. Everything they own goes
 * with them (the tables cascade from the organization). Each purge is logged
 * first, in the platform trail, which outlives the organization. Once the rows
 * are gone, `removeFiles` deletes the uploaded bytes; if that fails the purge
 * is still done and the error is reported so the leftovers can be cleared.
 */
export async function purgeScheduledOrganizations(
  db: typeof Database,
  options: {
    now?: Date;
    removeFiles?: (keys: string[]) => Promise<void>;
  } = {},
) {
  const now = options.now ?? new Date();
  const due = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(
      and(
        isNotNull(organizations.deletionScheduledFor),
        lte(organizations.deletionScheduledFor, now),
      ),
    )
    .limit(10);

  for (const organization of due) {
    await db.insert(platformAuditEvents).values({
      actorId: SYSTEM_ACTOR_ID,
      actorEmail: "system",
      action: "tenant.purged",
      organizationId: organization.id,
      targetType: "organization",
      targetId: organization.id,
      label: organization.name,
    });
    const keys = (
      await db
        .select({ key: files.storageKey })
        .from(files)
        .where(eq(files.organizationId, organization.id))
    ).map((row) => row.key);

    await db.delete(organizations).where(eq(organizations.id, organization.id));

    if (keys.length && options.removeFiles) {
      try {
        await options.removeFiles(keys);
      } catch (error) {
        await reportError("purge-files", error);
      }
    }
  }

  return due.length;
}
