import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { roles, teamMembers } from "@kyren/db/schema";
import { type TestOrg, type World } from "./world";

export const forbidden = { code: "FORBIDDEN" };
export const notFound = { code: "NOT_FOUND" };

/** Replaces what the organization's Member role grants. */
export async function setMemberRole(world: World, org: TestOrg, permissions: string[]) {
  await db
    .update(roles)
    .set({ permissions })
    .where(eq(roles.id, await world.systemRoleId(org, "member")));
}

export async function addToTeam(
  org: TestOrg,
  teamId: string,
  member: { id: string },
) {
  await db
    .insert(teamMembers)
    .values({ organizationId: org.id, teamId, memberId: member.id });
}
