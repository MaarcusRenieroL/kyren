import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, isNull, or, sql } from "@zentro/db/drizzle";
import { docs, members, projects, teams, users } from "@zentro/db/schema";
import { z } from "zod";

import {
  getDocByIdSchema,
  getDocBySlugSchema,
  getDocsSchema,
  searchDocsSchema,
} from "../../../types/zod-schema";
import { visibleDocsCondition } from "../../access";
import { docById, docBySlug } from "../../resources";
import { listProcedure, permissionProcedure } from "../../trpc";
import {
  getDocForActiveOrganization,
  plainContent,
  shareOf,
} from "./helpers";

export const docQueriesProcedures = {
  getAll: listProcedure("docs.view", "docs")
    .input(getDocsSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const conditions = [
        eq(docs.organizationId, activeOrganization.id),
        await visibleDocsCondition(ctx.permissions, "docs.view"),
      ];

      // The trash is for people who can restore from it.
      if (
        !input.includeDeleted ||
        !(await ctx.permissions.can("docs.restore"))
      ) {
        conditions.push(isNull(docs.deletedAt));
      }

      if (input.projectId) {
        conditions.push(eq(docs.projectId, input.projectId));
      }

      if (input.teamId) {
        conditions.push(eq(docs.teamId, input.teamId));
      }

      const docsList = await db
        .select({
          id: docs.id,
          title: docs.title,
          slug: docs.slug,
          projectId: docs.projectId,
          projectName: projects.name,
          projectKey: projects.taskKeyPrefix,
          teamId: docs.teamId,
          teamName: teams.name,
          teamColor: teams.color,
          createdBy: users.name,
          createdByUserId: members.userId,
          // The opening words, without Markdown marks, for previews.
          excerpt: sql<string>`left(trim(${plainContent}), 180)`,
          deletedAt: docs.deletedAt,
          createdAt: docs.createdAt,
          updatedAt: docs.updatedAt,
        })
        .from(docs)
        .leftJoin(members, eq(members.id, docs.createdByMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .leftJoin(projects, eq(projects.id, docs.projectId))
        .leftJoin(teams, eq(teams.id, docs.teamId))
        .where(and(...conditions))
        .orderBy(desc(docs.updatedAt));

      return docsList;
    }),

  search: listProcedure("docs.search", "docs")
    .input(searchDocsSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const query = input.query.trim();
      const conditions = [
        eq(docs.organizationId, activeOrganization.id),
        await visibleDocsCondition(ctx.permissions, "docs.search"),
      ];

      // The trash is for people who can restore from it.
      if (
        !input.includeDeleted ||
        !(await ctx.permissions.can("docs.restore"))
      ) {
        conditions.push(isNull(docs.deletedAt));
      }

      if (input.projectId) {
        conditions.push(eq(docs.projectId, input.projectId));
      }

      if (input.teamId) {
        conditions.push(eq(docs.teamId, input.teamId));
      }

      if (query) {
        const pattern = `%${query}%`;

        conditions.push(
          or(
            ilike(docs.title, pattern),
            ilike(docs.content, pattern),
            ilike(projects.name, pattern),
            ilike(teams.name, pattern),
            ilike(users.name, pattern),
          )!,
        );
      }

      return db
        .select({
          id: docs.id,
          title: docs.title,
          slug: docs.slug,
          projectId: docs.projectId,
          projectName: projects.name,
          teamId: docs.teamId,
          teamName: teams.name,
          teamColor: teams.color,
          createdBy: users.name,
          createdByUserId: members.userId,
          projectKey: projects.taskKeyPrefix,
          // About 160 characters of plain text around the first match.
          snippet: sql<string>`substr(${plainContent}, greatest(strpos(lower(${plainContent}), lower(${query})) - 50, 1), 160)`,
          deletedAt: docs.deletedAt,
          createdAt: docs.createdAt,
          updatedAt: docs.updatedAt,
        })
        .from(docs)
        .leftJoin(members, eq(members.id, docs.createdByMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .leftJoin(projects, eq(projects.id, docs.projectId))
        .leftJoin(teams, eq(teams.id, docs.teamId))
        .where(and(...conditions))
        .orderBy(desc(docs.updatedAt))
        .limit(50);
    }),

  getById: permissionProcedure("docs.view", docById("id"), {
    module: "docs",
  })
    .input(getDocByIdSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      const [doc] = await db
        .select({
          id: docs.id,
          title: docs.title,
          content: docs.content,
          slug: docs.slug,
          projectId: docs.projectId,
          projectName: projects.name,
          teamId: docs.teamId,
          teamName: teams.name,
          teamColor: teams.color,
          createdByMemberId: docs.createdByMemberId,
          createdByUserId: members.userId,
          createdBy: users.name,
          deletedAt: docs.deletedAt,
          createdAt: docs.createdAt,
          updatedAt: docs.updatedAt,
        })
        .from(docs)
        .leftJoin(members, eq(members.id, docs.createdByMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .leftJoin(projects, eq(projects.id, docs.projectId))
        .leftJoin(teams, eq(teams.id, docs.teamId))
        .where(
          and(
            eq(docs.id, input.id),
            eq(docs.organizationId, activeOrganization.id),
            isNull(docs.deletedAt),
          ),
        )
        .limit(1);

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Doc not found.",
        });
      }

      return doc;
    }),

  getBySlug: permissionProcedure("docs.view", docBySlug, {
    module: "docs",
  })
    .input(getDocBySlugSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      const [doc] = await db
        .select({
          id: docs.id,
          title: docs.title,
          content: docs.content,
          slug: docs.slug,
          projectId: docs.projectId,
          projectName: projects.name,
          teamId: docs.teamId,
          teamName: teams.name,
          teamColor: teams.color,
          createdByMemberId: docs.createdByMemberId,
          createdByUserId: members.userId,
          createdBy: users.name,
          deletedAt: docs.deletedAt,
          createdAt: docs.createdAt,
          updatedAt: docs.updatedAt,
        })
        .from(docs)
        .leftJoin(members, eq(members.id, docs.createdByMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .leftJoin(projects, eq(projects.id, docs.projectId))
        .leftJoin(teams, eq(teams.id, docs.teamId))
        .where(
          and(
            eq(docs.slug, input.slug),
            eq(docs.organizationId, activeOrganization.id),
            isNull(docs.deletedAt),
          ),
        )
        .limit(1);

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Doc not found.",
        });
      }

      return doc;
    }),

  shareLink: permissionProcedure("docs.view", docById("id"), {
    module: "docs",
    also: ["docs.update_own"],
  })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const doc = await getDocForActiveOrganization({ ctx, id: input.id });
      const share = await shareOf(ctx, doc.id);
      const canManage = (
        await ctx.permissions.check(
          "docs.update_own",
          await docById("id")({ ctx, input }),
        )
      ).allowed;

      return {
        shared: Boolean(share.shareToken),
        canManage,
        // Only people who may turn the link off get to pass it around.
        token: canManage ? share.shareToken : null,
      };
    }),
};
