import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull } from "@zentro/db/drizzle";
import { members, teamMembers, teams, users } from "@zentro/db/schema";

import { getTeamByIdSchema } from "../../../types/zod-schema";
import {
  denialFor,
  listProcedure,
  permissionProcedure,
  protectedProcedure,
} from "../../trpc";
import { teamById } from "../../resources";

export const teamQueriesProcedures = {
  // Everyone who can view teams organization-wide sees all of them. A role
  // given on a single team shows only that team.
  getAll: listProcedure("teams.view").query(async ({ ctx }) => {
    const { activeOrganization, db } = ctx;
    const everywhere = await ctx.permissions.can("teams.view");
    const visibleTeamIds = everywhere
      ? null
      : await ctx.permissions.teamIdsWith("teams.view");

    if (visibleTeamIds && !visibleTeamIds.length) {
      throw denialFor({ allowed: false, reasons: [] });
    }

    const teamRows = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        color: teams.color,
        createdByMemberId: teams.createdByMemberId,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
      })
      .from(teams)
      .where(
        and(
          eq(teams.organizationId, activeOrganization.id),
          isNull(teams.archivedAt),
          visibleTeamIds ? inArray(teams.id, visibleTeamIds) : undefined,
        ),
      )
      .orderBy(asc(teams.name));

    if (!teamRows.length) {
      return [];
    }

    const memberships = await db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        memberId: members.id,
        role: members.role,
        userId: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        createdAt: teamMembers.createdAt,
      })
      .from(teamMembers)
      .innerJoin(members, eq(members.id, teamMembers.memberId))
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          eq(teamMembers.organizationId, activeOrganization.id),
          inArray(
            teamMembers.teamId,
            teamRows.map((team) => team.id),
          ),
        ),
      )
      .orderBy(asc(users.name), asc(users.email));

    return teamRows.map((team) => ({
      ...team,
      members: memberships.filter(
        (membership) => membership.teamId === team.id,
      ),
    }));
  }),

  getById: permissionProcedure("teams.view", teamById("id"))
    .input(getTeamByIdSchema)
    .query(async ({ ctx, input }) => {
      const { activeOrganization, db } = ctx;

      const [team] = await db
        .select({
          id: teams.id,
          name: teams.name,
          description: teams.description,
          color: teams.color,
          createdByMemberId: teams.createdByMemberId,
          createdAt: teams.createdAt,
          updatedAt: teams.updatedAt,
        })
        .from(teams)
        .where(
          and(
            eq(teams.id, input.id),
            eq(teams.organizationId, activeOrganization.id),
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

      const memberships = await db
        .select({
          id: teamMembers.id,
          teamId: teamMembers.teamId,
          memberId: members.id,
          role: members.role,
          userId: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          createdAt: teamMembers.createdAt,
        })
        .from(teamMembers)
        .innerJoin(members, eq(members.id, teamMembers.memberId))
        .innerJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(teamMembers.organizationId, activeOrganization.id),
            eq(teamMembers.teamId, team.id),
          ),
        )
        .orderBy(asc(users.name), asc(users.email));

      return {
        ...team,
        members: memberships,
      };
    }),

  // The people a team can be given: needed to view teams, or by a team lead
  // who adds people to their own team.
  getAvailableMembers: protectedProcedure
    .meta({ permissions: ["teams.view", "teams.members.manage"] })
    .query(async ({ ctx }) => {
      const { activeOrganization, db } = ctx;

      if (
        !(await ctx.permissions.can("teams.view")) &&
        !(await ctx.permissions.teamIdsWith("teams.members.manage")).length
      ) {
        throw denialFor({ allowed: false, reasons: [] });
      }

      return db
        .select({
          id: members.id,
          role: members.role,
          userId: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.organizationId, activeOrganization.id))
        .orderBy(asc(users.name), asc(users.email));
    }),
};
