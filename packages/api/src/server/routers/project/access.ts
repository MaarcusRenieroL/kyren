import { TRPCError } from "@trpc/server";
import { buildChanges } from "@zentro/audit";
import { and, asc, eq, inArray } from "@zentro/db/drizzle";
import {
  docs,
  projects,
  roleAssignments,
  roles,
  tasks,
  teams,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import { getProjectBySlugSchema } from "../../../types/zod-schema";
import { projectBySlug } from "../../resources";
import { permissionProcedure } from "../../trpc";

export const projectAccessProcedures = {
  getAccess: permissionProcedure("projects.view", projectBySlug("slug"), {
    module: "projects",
  })
    .input(getProjectBySlugSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const [project] = await db
        .select({
          id: projects.id,
          visibility: projects.visibility,
          teamId: projects.teamId,
        })
        .from(projects)
        .where(
          and(
            eq(projects.slug, input.slug),
            eq(projects.organizationId, activeOrganization.id),
          ),
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const assignments = await db
        .select({
          id: roleAssignments.id,
          roleId: roleAssignments.roleId,
          roleName: roles.name,
          principalType: roleAssignments.principalType,
          principalId: roleAssignments.principalId,
        })
        .from(roleAssignments)
        .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
        .where(
          and(
            eq(roleAssignments.organizationId, activeOrganization.id),
            eq(roleAssignments.scopeType, "project"),
            eq(roleAssignments.scopeId, project.id),
          ),
        );

      const userIds = assignments
        .filter((assignment) => assignment.principalType === "user")
        .map((assignment) => assignment.principalId);
      const teamIds = assignments
        .filter((assignment) => assignment.principalType === "team")
        .map((assignment) => assignment.principalId);
      const [userRows, teamRows] = await Promise.all([
        userIds.length
          ? db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(users)
              .where(inArray(users.id, userIds))
          : [],
        teamIds.length
          ? db
              .select({ id: teams.id, name: teams.name })
              .from(teams)
              .where(inArray(teams.id, teamIds))
          : [],
      ]);

      // Project roles are listed here so project leads can assign them
      // without needing the organization-level roles.view permission.
      const projectRoles = await db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, activeOrganization.id),
            eq(roles.scope, "project"),
          ),
        )
        .orderBy(asc(roles.name));

      return {
        projectId: project.id,
        visibility: project.visibility,
        teamId: project.teamId,
        availableRoles: projectRoles,
        assignments: assignments.map((assignment) => ({
          ...assignment,
          principalName:
            assignment.principalType === "user"
              ? (userRows.find((user) => user.id === assignment.principalId)
                  ?.name ?? "Unknown user")
              : (teamRows.find((team) => team.id === assignment.principalId)
                  ?.name ?? "Unknown team"),
        })),
      };
    }),

  updateAccess: permissionProcedure(
    "projects.settings.manage",
    projectBySlug("slug"),
    { module: "projects", audit: ["project.visibility_changed"] },
  )
    .input(
      getProjectBySlugSchema.extend({
        visibility: z.enum(["organization", "team", "private"]),
        teamId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const [existing] = await db
        .select({
          id: projects.id,
          name: projects.name,
          visibility: projects.visibility,
          teamId: projects.teamId,
        })
        .from(projects)
        .where(
          and(
            eq(projects.slug, input.slug),
            eq(projects.organizationId, activeOrganization.id),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      if (input.teamId) {
        const [team] = await db
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(
              eq(teams.id, input.teamId),
              eq(teams.organizationId, activeOrganization.id),
            ),
          )
          .limit(1);

        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }
      }

      if (input.visibility === "team" && !input.teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose the team that can see this project.",
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(projects)
          .set({
            visibility: input.visibility,
            teamId: input.teamId,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, existing.id));

        // The project's tasks and docs follow it to the new team, so team
        // roles apply to them the same way they apply to the project.
        if (input.teamId !== existing.teamId) {
          await tx
            .update(tasks)
            .set({ teamId: input.teamId })
            .where(eq(tasks.projectId, existing.id));
          await tx
            .update(docs)
            .set({ teamId: input.teamId })
            .where(eq(docs.projectId, existing.id));
        }

        await ctx.audit.record(tx, {
          action: "project.visibility_changed",
          target: { id: existing.id, label: existing.name },
          projectId: existing.id,
          teamId: input.teamId,
          changes: buildChanges(
            { visibility: existing.visibility, teamId: existing.teamId },
            { visibility: input.visibility, teamId: input.teamId },
          ),
          metadata: {
            before: {
              visibility: existing.visibility,
              teamId: existing.teamId,
            },
            after: { visibility: input.visibility, teamId: input.teamId },
          },
        });
      });

      return { projectId: existing.id };
    }),
};
