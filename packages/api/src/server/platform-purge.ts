import { and, eq, isNotNull, lte } from "@zentro/db/drizzle";
import type { db as Database } from "@zentro/db";
import { organizations, platformAuditEvents } from "@zentro/db/schema";

import { SYSTEM_ACTOR_ID } from "./platform-audit";

/**
 * Deletes organizations whose grace period has ended. Everything they own goes
 * with them (the tables cascade from the organization). Each purge is logged
 * first, in the platform trail, which outlives the organization.
 */
export async function purgeScheduledOrganizations(
  db: typeof Database,
  now = new Date(),
) {
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
    await db.delete(organizations).where(eq(organizations.id, organization.id));
  }

  return due.length;
}
