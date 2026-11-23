import { TRPCError } from "@trpc/server";
import { and, eq } from "@kyren/db/drizzle";
import { docs, members, projects, teams, workLinks } from "@kyren/db/schema";

import { createDocSchema } from "../../../types/zod-schema";
import { recordDocVersion } from "../../access";
import { syncMentions } from "../../mentions";
import { projectFromInput } from "../../resources";
import { permissionProcedure } from "../../trpc";
import { resolveTarget } from "../link";

export const docCreateProcedures = {
  create: permissionProcedure("docs.create", projectFromInput, {
    module: "docs",
    also: ["tasks.view"],
    audit: ["doc.created"],
  })
    .input(createDocSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;
      // Written for a task: the task must be one the caller can see.
      const linkTask = input.linkTaskKey
        ? await resolveTarget(ctx, { type: "task", key: input.linkTaskKey })
        : null;

      return db.transaction(async (tx) => {
        const [member] = await tx
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.userId, user.id),
              eq(members.organizationId, activeOrganization.id),
            ),
          )
          .limit(1);

        if (!member) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Member not found in active organization",
          });
        }

        let teamId = input.teamId ?? null;

        if (input.projectId) {
          const [project] = await tx
            .select({
              id: projects.id,
              teamId: projects.teamId,
            })
            .from(projects)
            .where(
              and(
                eq(projects.id, input.projectId),
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

          teamId = project.teamId;
        } else if (teamId) {
          const [team] = await tx
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

        const [doc] = await tx
          .insert(docs)
          .values({
            title: input.title,
            content: input.content,
            organizationId: activeOrganization.id,
            projectId: input.projectId,
            teamId,
            createdByMemberId: member.id,
            slug: input.slug,
          })
          .returning();

        if (!doc) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create doc.",
          });
        }

        await recordDocVersion(tx, {
          organizationId: activeOrganization.id,
          docId: doc.id,
          memberId: member.id,
          content: doc.content,
          fresh: true,
        });

        await ctx.audit.record(tx, {
          action: "doc.created",
          target: { id: doc.id, label: doc.title },
          projectId: doc.projectId,
          teamId: doc.teamId,
          metadata: {
            slug: doc.slug,
            ...(linkTask ? { linkedTo: linkTask.label } : {}),
          },
        });

        if (linkTask) {
          await tx.insert(workLinks).values({
            organizationId: activeOrganization.id,
            sourceType: "doc",
            sourceId: doc.id,
            targetType: "task",
            targetId: linkTask.id,
            kind: "relates",
            createdByMemberId: member.id,
          });
        }

        await syncMentions(tx, {
          organizationId: activeOrganization.id,
          memberId: member.id,
          source: { type: "doc", id: doc.id },
          text: doc.content,
          via: "content",
          mode: "replace",
        });

        return doc;
      });
    }),
};
