import { TRPCError } from "@trpc/server";
import { buildChanges } from "@kyren/audit";
import { and, eq } from "@kyren/db/drizzle";
import { docs, projects, tasks, teams } from "@kyren/db/schema";

import { updateProjectBySlugSchema } from "../../../types/zod-schema";
import { projectBySlug } from "../../resources";
import { assertAnyPermission, permissionProcedure } from "../../trpc";

export const projectUpdateProcedures = {
  updateProjectBySlug: permissionProcedure(
    "projects.update",
    projectBySlug("currentSlug"),
    { module: "projects", audit: ["project.updated"] },
  )
    .input(updateProjectBySlugSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const { currentSlug, name, slug, description } = input;

      const [existingProject] = await db
        .select({
          id: projects.id,
          slug: projects.slug,
          name: projects.name,
          description: projects.description,
          teamId: projects.teamId,
          visibility: projects.visibility,
          organizationId: projects.organizationId,
        })
        .from(projects)
        .where(
          and(
            eq(projects.slug, currentSlug),
            eq(projects.organizationId, activeOrganization.id),
          ),
        )
        .limit(1);

      if (!existingProject) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Leaving the team out keeps it. Moving the project to another team
      // changes who has access, which is the access settings' permission.
      let teamId =
        input.teamId === undefined ? existingProject.teamId : input.teamId;

      if (teamId !== existingProject.teamId) {
        await assertAnyPermission(ctx, ["projects.settings.manage"], {
          project: existingProject,
        });

        if (!teamId && existingProject.visibility === "team") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This project is visible to its team only. Change who can see it before removing the team.",
          });
        }
      }

      if (slug !== currentSlug) {
        const [slugConflict] = await db
          .select({
            id: projects.id,
          })
          .from(projects)
          .where(
            and(
              eq(projects.slug, slug),
              eq(projects.organizationId, activeOrganization.id),
            ),
          )
          .limit(1);

        if (slugConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Project slug is already taken",
          });
        }
      }

      if (teamId) {
        const [team] = await db
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(
              eq(teams.id, teamId),
              eq(teams.organizationId, activeOrganization.id),
            ),
          )
          .limit(1);

        if (!team) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found",
          });
        }

        teamId = team.id;
      }

      const updatedProject = await db.transaction(async (tx) => {
        const [project] = await tx
          .update(projects)
          .set({
            name,
            slug,
            description: description || null,
            teamId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(projects.id, existingProject.id),
              eq(projects.organizationId, activeOrganization.id),
            ),
          )
          .returning();

        if (!project) {
          return null;
        }

        await tx
          .update(tasks)
          .set({
            teamId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tasks.projectId, existingProject.id),
              eq(tasks.organizationId, activeOrganization.id),
            ),
          );

        await tx
          .update(docs)
          .set({
            teamId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(docs.projectId, existingProject.id),
              eq(docs.organizationId, activeOrganization.id),
            ),
          );

        const changes = buildChanges(
          {
            name: existingProject.name,
            slug: existingProject.slug,
            description: existingProject.description,
            teamId: existingProject.teamId,
          },
          { name, slug, description: description || null, teamId },
        );

        if (changes.length) {
          await ctx.audit.record(tx, {
            action: "project.updated",
            target: { id: project.id, label: project.name },
            projectId: project.id,
            teamId: project.teamId,
            metadata: { slug: project.slug },
            changes,
          });
        } else {
          ctx.audit.skipped("project.updated");
        }

        return project;
      });

      if (!updatedProject) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update project",
        });
      }

      return updatedProject;
    }),
};
