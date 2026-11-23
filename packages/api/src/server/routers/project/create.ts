import { TRPCError } from "@trpc/server";
import { and, eq } from "@zentro/db/drizzle";
import { projects, teams } from "@zentro/db/schema";

import {
  checkSlugSchema,
  createProjectSchema,
} from "../../../types/zod-schema";
import { assignCreatorLeadRole } from "../../access";
import { createProjectChannel } from "../../chat-events";
import { permissionProcedure } from "../../trpc";
import { createUniqueTaskKeyPrefix } from "./helpers";

export const projectCreateProcedures = {
  createProject: permissionProcedure("projects.create", undefined, {
    module: "projects",
    audit: ["project.created"],
  })
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const { name, slug, description } = input;
      const { db, user, activeOrganization } = ctx;
      let teamId = input.teamId ?? null;
      const taskKeyPrefix = await createUniqueTaskKeyPrefix({
        db,
        organizationId: activeOrganization.id,
        slug,
      });

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

      const project = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(projects)
          .values({
            name,
            slug,
            taskKeyPrefix,
            description: description || null,
            teamId,
            organizationId: activeOrganization.id,
            createdById: user.id,
            status: "active",
          })
          .returning();

        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create project",
          });
        }

        await ctx.audit.record(tx, {
          action: "project.created",
          target: { id: created.id, label: created.name },
          projectId: created.id,
          teamId: created.teamId,
          metadata: { slug: created.slug },
        });

        // Whoever creates a project leads it.
        await assignCreatorLeadRole(tx, ctx.audit, {
          organizationId: activeOrganization.id,
          userId: user.id,
          systemKey: "project_lead",
          scopeType: "project",
          scopeId: created.id,
          scopeName: created.name,
        });

        return created;
      });

      // A project starts with somewhere to talk, when chat is on.
      if ((await ctx.enabledModules()).has("chat")) {
        await createProjectChannel(db, {
          organizationId: activeOrganization.id,
          userId: user.id,
          project: { id: project.id, slug: project.slug, name: project.name },
        });
      }

      return project;
    }),

  checkSlug: permissionProcedure("projects.create", undefined, {
    module: "projects",
  })
    .input(checkSlugSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      const [project] = await db
        .select({
          id: projects.id,
        })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, activeOrganization.id),
            eq(projects.slug, input.slug),
          ),
        )
        .limit(1);

      return {
        available: !project,
      };
    }),
};
