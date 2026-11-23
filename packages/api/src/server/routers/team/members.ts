import { and, eq, inArray } from "@zentro/db/drizzle";
import {
  members,
  roleAssignments,
  roles,
  teamMembers,
  teams,
  users,
} from "@zentro/db/schema";

import { updateTeamMembersSchema } from "../../../types/zod-schema";
import { permissionProcedure } from "../../trpc";
import { assertHoldsAll } from "../../access";
import { loadProjectById, teamById } from "../../resources";
import { assertTeamInOrganization, replaceTeamMembers } from "./helpers";

export const teamMembersProcedures = {
  updateMembers: permissionProcedure(
    "teams.members.manage",
    teamById("teamId"),
    {
      audit: ["team.member_added", "team.member_removed"],
    },
  )
    .input(updateTeamMembersSchema)
    .mutation(async ({ ctx, input }) => {
      const { activeOrganization, db } = ctx;

      const team = await assertTeamInOrganization({
        db,
        organizationId: activeOrganization.id,
        teamId: input.teamId,
      });

      return db.transaction(async (tx) => {
        const before = new Set(
          (
            await tx
              .select({ memberId: teamMembers.memberId })
              .from(teamMembers)
              .where(eq(teamMembers.teamId, input.teamId))
          ).map((row) => row.memberId),
        );

        // Joining a team brings the roles assigned to it. Adding someone
        // hands those out, so the caller must hold them all, in each scope.
        if (input.memberIds.some((id) => !before.has(id))) {
          const granted = await tx
            .select({
              scopeType: roleAssignments.scopeType,
              scopeId: roleAssignments.scopeId,
              permissions: roles.permissions,
            })
            .from(roleAssignments)
            .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
            .where(
              and(
                eq(roleAssignments.organizationId, activeOrganization.id),
                eq(roleAssignments.principalType, "team"),
                eq(roleAssignments.principalId, input.teamId),
              ),
            );

          for (const grant of granted) {
            const project =
              grant.scopeType === "project"
                ? await loadProjectById(ctx, grant.scopeId)
                : undefined;

            if (grant.scopeType === "project" && !project) continue;

            await assertHoldsAll(
              ctx.permissions,
              grant.permissions,
              grant.scopeType === "team"
                ? { teamId: grant.scopeId }
                : project
                  ? { project }
                  : {},
              "You can only add people to this team if you hold every role it gives.",
            );
          }
        }

        const memberIds = await replaceTeamMembers({
          db: tx,
          organizationId: activeOrganization.id,
          teamId: input.teamId,
          memberIds: input.memberIds,
        });

        await tx
          .update(teams)
          .set({ updatedAt: new Date() })
          .where(eq(teams.id, input.teamId));

        const after = new Set(memberIds);
        const added = memberIds.filter((id) => !before.has(id));
        const removed = [...before].filter((id) => !after.has(id));
        const changed = [...added, ...removed];
        const people = changed.length
          ? await tx
              .select({
                memberId: members.id,
                userId: members.userId,
                name: users.name,
                email: users.email,
              })
              .from(members)
              .innerJoin(users, eq(users.id, members.userId))
              .where(inArray(members.id, changed))
          : [];

        for (const [action, ids] of [
          ["team.member_added", added],
          ["team.member_removed", removed],
        ] as const) {
          for (const id of ids) {
            const person = people.find((item) => item.memberId === id);

            await ctx.audit.record(tx, {
              action,
              target: { id: team.id, label: team.name },
              teamId: team.id,
              metadata: {
                memberId: id,
                userId: person?.userId,
                name: person?.name || person?.email,
              },
            });
          }
        }

        if (!changed.length) {
          ctx.audit.skipped("team.member_added");
        }

        return { memberIds };
      });
    }),
};
