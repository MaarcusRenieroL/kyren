import { APIError } from "better-auth/api";
import { db } from "@kyren/db";
import { and, eq, sql } from "@kyren/db/drizzle";
import * as schema from "@kyren/db/schema";

/** How many organizations one person may own; `ORGANIZATIONS_PER_PERSON`, default 10. */
export function organizationsPerPerson() {
  const configured = Number(process.env.ORGANIZATIONS_PER_PERSON);

  return Number.isInteger(configured) && configured > 0 ? configured : 10;
}

/**
 * Whether the person already owns as many organizations as allowed. Only
 * ownership counts: being invited into other organizations never stops
 * someone from starting their own.
 */
export async function ownsTooManyOrganizations(userId: string) {
  const owned = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(
      and(
        eq(schema.members.userId, userId),
        // Roles can be a list, such as "owner,admin".
        sql`'owner' = any(string_to_array(${schema.members.role}, ','))`,
      ),
    );

  return owned.length >= organizationsPerPerson();
}

/** Throws when an operator's member limit for the organization is already reached. */
export async function assertSeatAvailable(organizationId: string) {
  const [row] = await db
    .select({ limits: schema.organizations.limits })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1);
  const seats = row?.limits.members;

  if (!seats) return;

  const joined = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(eq(schema.members.organizationId, organizationId));

  if (joined.length >= seats) {
    throw new APIError("FORBIDDEN", {
      message: `This organization has reached its limit of ${seats} members.`,
    });
  }
}
