import { TRPCError } from "@trpc/server";
import { and, eq, isNull, ne } from "@zentro/db/drizzle";
import { teams } from "@zentro/db/schema";
import { buildChanges } from "@zentro/audit";

import {
  createTeamSchema,
  deleteTeamSchema,
  updateTeamSchema,
} from "../../../types/zod-schema";
import { permissionProcedure } from "../../trpc";
import { assignCreatorLeadRole } from "../../access";
import { teamById } from "../../resources";
import {
  assertTeamInOrganization,
  getCurrentMemberId,
  replaceTeamMembers,
} from "./helpers";

export const teamMutationsProcedures = {
  create: permissionProcedure("teams.create", undefined, {
    audit: ["team.created"],
  })
    .input(createTeamSchema)
    .mutation(async ({ ctx, input }) => {
      const { activeOrganization, db, user } = ctx;

      const created = await db.transaction(async (tx) => {
        const createdByMemberId = await getCurrentMemberId({
          db: tx,
          organizationId: activeOrganization.id,
          userId: user.id,
        });

        const [existingTeam] = await tx
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(
              eq(teams.organizationId, activeOrganization.id),
              eq(teams.name, input.name),
              isNull(teams.archivedAt),
            ),
          )
          .limit(1);

        if (existingTeam) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A team with this name already exists.",
          });
        }

        const [team] = await tx
          .insert(teams)
          .values({
            organizationId: activeOrganization.id,
            name: input.name,
            description: input.description || null,
            color: input.color,
            createdByMemberId,
          })
          .returning();

        if (!team) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create team.",
          });
        }

        await replaceTeamMembers({
          db: tx,
          organizationId: activeOrganization.id,
          teamId: team.id,
          memberIds: input.memberIds,
        });

        await ctx.audit.record(tx, {
          action: "team.created",
          target: { id: team.id, label: team.name },
          teamId: team.id,
          metadata: { memberCount: new Set(input.memberIds).size },
        });

        // Whoever creates a team leads it.
        await assignCreatorLeadRole(tx, ctx.audit, {
          organizationId: activeOrganization.id,
          userId: user.id,
          systemKey: "team_lead",
          scopeType: "team",
          scopeId: team.id,
          scopeName: team.name,
        });

        return team;
      });

      return created;
    }),

  update: permissionProcedure("teams.update", teamById("id"), {
    audit: ["team.updated"],
  })
    .input(updateTeamSchema)
    .mutation(async ({ ctx, input }) => {
      const { activeOrganization, db } = ctx;

      const previous = await assertTeamInOrganization({
        db,
        organizationId: activeOrganization.id,
        teamId: input.id,
      });

      const [nameConflict] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.organizationId, activeOrganization.id),
            eq(teams.name, input.name),
            ne(teams.id, input.id),
            isNull(teams.archivedAt),
          ),
        )
        .limit(1);

      if (nameConflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A team with this name already exists.",
        });
      }

      const team = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(teams)
          .set({
            name: input.name,
            description: input.description || null,
            color: input.color,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(teams.id, input.id),
              eq(teams.organizationId, activeOrganization.id),
              isNull(teams.archivedAt),
            ),
          )
          .returning();

        if (!row) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update team.",
          });
        }

        const changes = buildChanges(
          {
            name: previous.name,
            description: previous.description,
            color: previous.color,
          },
          {
            name: row.name,
            description: row.description,
            color: row.color,
          },
        );

        if (changes.length) {
          await ctx.audit.record(tx, {
            action: "team.updated",
            target: { id: row.id, label: row.name },
            teamId: row.id,
            changes,
          });
        } else {
          ctx.audit.skipped("team.updated");
        }

        return row;
      });

      return team;
    }),

  delete: permissionProcedure("teams.delete", teamById("id"), {
    audit: ["team.deleted"],
  })
    .input(deleteTeamSchema)
    .mutation(async ({ ctx, input }) => {
      const { activeOrganization, db } = ctx;

      return db.transaction(async (tx) => {
        const [team] = await tx
          .delete(teams)
          .where(
            and(
              eq(teams.id, input.id),
              eq(teams.organizationId, activeOrganization.id),
            ),
          )
          .returning({ id: teams.id, name: teams.name });

        if (!team) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found.",
          });
        }

        await ctx.audit.record(tx, {
          action: "team.deleted",
          target: { id: team.id, label: team.name },
          teamId: team.id,
        });

        return { id: team.id };
      });
    }),
};
