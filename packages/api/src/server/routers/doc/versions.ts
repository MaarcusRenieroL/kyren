import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, sql } from "@kyren/db/drizzle";
import { docVersions, docs, members, users } from "@kyren/db/schema";

import {
  docVersionSchema,
  getDocByIdSchema,
  restoreDocVersionSchema,
} from "../../../types/zod-schema";
import { recordDocVersion } from "../../access";
import { syncMentions } from "../../mentions";
import { docById } from "../../resources";
import { permissionProcedure } from "../../trpc";
import { getCurrentMember } from "../task-helpers";

export const docVersionsProcedures = {
  getVersionHistory: permissionProcedure("docs.view", docById("id"), {
    module: "docs",
  })
    .input(getDocByIdSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const versions = await db
        .select({
          id: docVersions.id,
          snippet: sql<string>`left(${docVersions.content}, 160)`,
          length: sql<number>`length(${docVersions.content})::int`,
          updatedAt: docVersions.updatedAt,
          authorName: users.name,
          authorEmail: users.email,
        })
        .from(docVersions)
        .leftJoin(members, eq(members.id, docVersions.authorMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(docVersions.organizationId, activeOrganization.id),
            eq(docVersions.docId, input.id),
          ),
        )
        .orderBy(desc(docVersions.updatedAt))
        .limit(30);

      return versions.map((version) => ({
        id: version.id,
        savedAt: version.updatedAt,
        authorName: version.authorName || version.authorEmail || "Teammate",
        snippet: version.snippet,
        length: version.length,
      }));
    }),

  /** One version's full text, for the preview in the history panel. */
  getVersion: permissionProcedure("docs.view", docById("id"), {
    module: "docs",
  })
    .input(docVersionSchema)
    .query(async ({ ctx, input }) => {
      const [version] = await ctx.db
        .select({ id: docVersions.id, content: docVersions.content })
        .from(docVersions)
        .where(
          and(
            eq(docVersions.id, input.versionId),
            eq(docVersions.docId, input.id),
            eq(docVersions.organizationId, ctx.activeOrganization.id),
          ),
        )
        .limit(1);

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That version of the doc no longer exists.",
        });
      }

      return version;
    }),

  restoreVersion: permissionProcedure("docs.update_own", docById("id"), {
    module: "docs",
    audit: ["doc.updated"],
  })
    .input(restoreDocVersionSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const { id, versionId, expectedUpdatedAt } = input;
      const member = await getCurrentMember(ctx);

      return db.transaction(async (tx) => {
        const [version] = await tx
          .select({ content: docVersions.content })
          .from(docVersions)
          .innerJoin(docs, eq(docs.id, docVersions.docId))
          .where(
            and(
              eq(docVersions.id, versionId),
              eq(docVersions.docId, id),
              eq(docVersions.organizationId, activeOrganization.id),
              // A trashed doc comes back from the trash first.
              isNull(docs.deletedAt),
            ),
          )
          .limit(1);

        if (!version) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "That version of the doc no longer exists.",
          });
        }

        const { content } = version;
        const [updatedDoc] = await tx
          .update(docs)
          .set({
            content,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(docs.id, id),
              eq(docs.organizationId, activeOrganization.id),
              isNull(docs.deletedAt),
              // A restore is an edit too: never over someone's newer change.
              // Stored with microseconds; the client copy has milliseconds.
              sql`date_trunc('milliseconds', ${docs.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`,
            ),
          )
          .returning();

        if (!updatedDoc) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Someone else changed this doc. Reload to see their edits.",
          });
        }

        await recordDocVersion(tx, {
          organizationId: activeOrganization.id,
          docId: updatedDoc.id,
          memberId: member.id,
          content,
          fresh: true,
        });

        await ctx.audit.record(tx, {
          action: "doc.updated",
          target: { id: updatedDoc.id, label: updatedDoc.title },
          projectId: updatedDoc.projectId,
          teamId: updatedDoc.teamId,
          metadata: {
            slug: updatedDoc.slug,
            fields: ["content"],
            restored: true,
          },
        });

        await syncMentions(tx, {
          organizationId: activeOrganization.id,
          memberId: member.id,
          source: { type: "doc", id: updatedDoc.id },
          text: updatedDoc.content,
          via: "content",
          mode: "replace",
        });

        return updatedDoc;
      });
    }),
};
