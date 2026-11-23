import { and, eq } from "@kyren/db/drizzle";
import { members, teamMembers } from "@kyren/db/schema";

import { type OrganizationContext } from "../../trpc";
import { loadMemberOfOrganization } from "./helpers";
import {
  baseRank,
  forbidden,
  isOwnerRole,
  notFound,
  rankOf,
} from "./types";

/** Only an owner changes the Admin system role. */
export async function assertOwnerForAdminRole(
  ctx: OrganizationContext,
  systemKey: string | null,
) {
  if (systemKey !== "admin") return;

  const caller = await ctx.permissions.snapshot();

  if (!caller.baseRole || !isOwnerRole(caller.baseRole)) {
    throw forbidden("Only an owner can change the Admin role.");
  }
}

/**
 * Self-service and rank protection shared by assignments and overrides: you
 * cannot change your own access, an owner's access, or the access of someone
 * who outranks you (an admin, when you are not one).
 */
export async function assertMayModifyUser(
  ctx: OrganizationContext,
  userId: string,
) {
  if (userId === ctx.user.id) {
    throw forbidden("You cannot change your own roles or overrides.");
  }

  const target = await loadMemberOfOrganization(ctx, userId);

  if (!target) {
    throw notFound("That person is not a member of this organization.");
  }

  if (isOwnerRole(target.role)) {
    throw forbidden("An owner's access cannot be changed.");
  }

  const caller = await ctx.permissions.snapshot();

  const targetRank = rankOf(target.role);
  const callerRank = rankOf(caller.baseRole);

  if (targetRank > callerRank) {
    throw forbidden(
      "You cannot change the access of someone with a higher role than yours.",
    );
  }

  if (targetRank >= baseRank.admin && targetRank === callerRank) {
    throw forbidden("Only an owner can change another admin's access.");
  }
}

/**
 * A team lead (who holds team-level management but not organization-wide role
 * assignment) works within their own team only.
 */
export async function assertTeamLeadBounds(
  ctx: OrganizationContext,
  teamId: string,
  principal: { type: "user" | "team"; id: string },
) {
  if (await ctx.permissions.can("roles.assign")) {
    return;
  }

  if (principal.type === "team") {
    if (principal.id !== teamId) {
      throw forbidden("You can only give roles to your own team.");
    }

    return;
  }

  const [membership] = await ctx.db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .innerJoin(members, eq(members.id, teamMembers.memberId))
    .where(
      and(eq(teamMembers.teamId, teamId), eq(members.userId, principal.id)),
    )
    .limit(1);

  if (!membership) {
    throw forbidden("That person is not a member of this team.");
  }
}
