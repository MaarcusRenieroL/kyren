import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or } from "@kyren/db/drizzle";
import { docs, projects, tasks, workLinks } from "@kyren/db/schema";

import {
  archiveProjectBySlugSchema,
  deleteProjectBySlugSchema,
} from "../../../types/zod-schema";
import { projectBySlug } from "../../resources";
import { permissionProcedure } from "../../trpc";

export const projectLifecycleProcedures = {
  archiveProject: permissionProcedure(
    "projects.archive",
    projectBySlug("slug"),
    { module: "projects", audit: ["project.archived", "project.restored"] },
  )
    .input(archiveProjectBySlugSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const { slug } = input;

      const [existingProject] = await db
        .select({
          id: projects.id,
          slug: projects.slug,
          name: projects.name,
          organizationId: projects.organizationId,
          status: projects.status,
        })
        .from(projects)
        .where(
          and(
            eq(projects.slug, slug),
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

      const nextStatus =
        existingProject.status === "archived" ? "active" : "archived";

      const updatedProject = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(projects)
          .set({
            status: nextStatus,
            archivedAt: nextStatus === "archived" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(projects.id, existingProject.id),
              eq(projects.organizationId, activeOrganization.id),
            ),
          )
          .returning();

        if (row) {
          await ctx.audit.record(tx, {
            action:
              nextStatus === "archived"
                ? "project.archived"
                : "project.restored",
            target: { id: row.id, label: row.name },
            projectId: row.id,
            teamId: row.teamId,
            metadata: { slug: row.slug },
          });
        }

        return row;
      });

      if (!updatedProject) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            nextStatus === "archived"
              ? "Failed to archive project"
              : "Failed to restore project",
        });
      }

      return updatedProject;
    }),

  deleteProject: permissionProcedure("projects.delete", projectBySlug("slug"), {
    module: "projects",
    audit: ["project.deleted"],
  })
    .input(deleteProjectBySlugSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const { slug } = input;

      const [existingProject] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.slug, slug),
            eq(projects.organizationId, activeOrganization.id),
          ),
        );

      if (!existingProject) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project with given slug not found",
        });
      }

      const deletedProject = await db.transaction(async (tx) => {
        // The project's docs go with it, as the delete dialog says. Left
        // behind they would lose the project's privacy and show to everyone.
        const [projectDocs, projectTasks] = await Promise.all([
          tx
            .select({ id: docs.id })
            .from(docs)
            .where(eq(docs.projectId, existingProject.id)),
          tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(eq(tasks.projectId, existingProject.id)),
        ]);
        const docIds = projectDocs.map((row) => row.id);
        const taskIds = projectTasks.map((row) => row.id);
        const gone = [
          ...(docIds.length
            ? [
                and(
                  eq(workLinks.sourceType, "doc"),
                  inArray(workLinks.sourceId, docIds),
                ),
                and(
                  eq(workLinks.targetType, "doc"),
                  inArray(workLinks.targetId, docIds),
                ),
              ]
            : []),
          ...(taskIds.length
            ? [
                and(
                  eq(workLinks.sourceType, "task"),
                  inArray(workLinks.sourceId, taskIds),
                ),
                and(
                  eq(workLinks.targetType, "task"),
                  inArray(workLinks.targetId, taskIds),
                ),
              ]
            : []),
        ];

        if (gone.length) {
          await tx
            .delete(workLinks)
            .where(
              and(
                eq(workLinks.organizationId, activeOrganization.id),
                or(...gone),
              ),
            );
        }

        if (docIds.length) {
          await tx.delete(docs).where(inArray(docs.id, docIds));
        }

        const [row] = await tx
          .delete(projects)
          .where(
            and(
              eq(projects.slug, slug),
              eq(projects.organizationId, activeOrganization.id),
            ),
          )
          .returning();

        if (row) {
          // The event outlives the project: it keeps the project id and name.
          await ctx.audit.record(tx, {
            action: "project.deleted",
            target: { id: row.id, label: row.name },
            projectId: row.id,
            teamId: row.teamId,
            metadata: { slug: row.slug },
          });
        }

        return row;
      });

      if (!deletedProject) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update project",
        });
      }

      return deletedProject;
    }),
};
