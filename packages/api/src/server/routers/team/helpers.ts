import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "@kyren/db/drizzle";
import { members, teams, teamMembers } from "@kyren/db/schema";

export type TeamDbClient = Pick<
  typeof import("@kyren/db").db,
  "delete" | "insert" | "select" | "update"
>;

export async function getCurrentMemberId({
  db,
  organizationId,
  userId,
}: {
  db: TeamDbClient;
  organizationId: string;
  userId: string;
}) {
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        eq(members.userId, userId),
      ),
    )
    .limit(1);

  if (!member) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Member not found in active organization.",
    });
  }

  return member.id;
}

export async function assertTeamInOrganization({
  db,
  organizationId,
  teamId,
}: {
  db: TeamDbClient;
  organizationId: string;
  teamId: string;
}) {
  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      color: teams.color,
    })
    .from(teams)
    .where(
      and(
        eq(teams.id, teamId),
        eq(teams.organizationId, organizationId),
        isNull(teams.archivedAt),
      ),
    )
    .limit(1);

  if (!team) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Team not found.",
    });
  }

  return team;
}

export async function assertMembersInOrganization({
  db,
  organizationId,
  memberIds,
}: {
  db: TeamDbClient;
  organizationId: string;
  memberIds: string[];
}) {
  const uniqueMemberIds = Array.from(new Set(memberIds));

  if (!uniqueMemberIds.length) {
    return uniqueMemberIds;
  }

  const existingMembers = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        inArray(members.id, uniqueMemberIds),
      ),
    );

  if (existingMembers.length !== uniqueMemberIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more members do not belong to this organization.",
    });
  }

  return uniqueMemberIds;
}

export async function replaceTeamMembers({
  db,
  organizationId,
  teamId,
  memberIds,
}: {
  db: TeamDbClient;
  organizationId: string;
  teamId: string;
  memberIds: string[];
}) {
  const uniqueMemberIds = await assertMembersInOrganization({
    db,
    organizationId,
    memberIds,
  });

  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));

  if (uniqueMemberIds.length) {
    await db.insert(teamMembers).values(
      uniqueMemberIds.map((memberId) => ({
        organizationId,
        teamId,
        memberId,
      })),
    );
  }

  return uniqueMemberIds;
}
