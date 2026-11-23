import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, or } from "@kyren/db/drizzle";
import { docComments, members, users } from "@kyren/db/schema";
import { sanitizeRichText } from "@kyren/utils";

import {
  createDocCommentSchema,
  deleteDocCommentSchema,
  getDocCommentsSchema,
  resolveDocCommentSchema,
  updateDocCommentSchema,
} from "../../../types/zod-schema";
import { syncMentions } from "../../mentions";
import { docByCommentId, docById } from "../../resources";
import { assertAnyPermission, permissionProcedure } from "../../trpc";
import { getCurrentMember } from "../task-helpers";
import { getDocForActiveOrganization, openComment } from "./helpers";

export const docCommentsProcedures = {
  getComments: permissionProcedure("docs.view", docById("docId"), {
    module: "docs",
  })
    .input(getDocCommentsSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const doc = await getDocForActiveOrganization({ ctx, id: input.docId });

      const member = await getCurrentMember(ctx);
      // People who may edit any doc here can remove anyone's comment.
      const moderates = (
        await ctx.permissions.check("docs.update_any", {
          projectId: doc.projectId,
          teamId: doc.teamId,
        })
      ).allowed;

      const rows = await db
        .select({
          id: docComments.id,
          parentId: docComments.parentId,
          body: docComments.body,
          authorMemberId: docComments.authorMemberId,
          authorName: users.name,
          authorEmail: users.email,
          authorImage: users.image,
          resolvedAt: docComments.resolvedAt,
          createdAt: docComments.createdAt,
          updatedAt: docComments.updatedAt,
        })
        .from(docComments)
        .leftJoin(members, eq(members.id, docComments.authorMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(docComments.organizationId, activeOrganization.id),
            eq(docComments.docId, doc.id),
            isNull(docComments.deletedAt),
          ),
        )
        .orderBy(asc(docComments.createdAt));

      return rows.map((row) => {
        const mine = row.authorMemberId === member.id;

        return { ...row, canEdit: mine, canDelete: mine || moderates };
      });
    }),

  createComment: permissionProcedure("docs.comment", docById("docId"), {
    module: "docs",
    audit: ["doc.comment_added"],
  })
    .input(createDocCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const doc = await getDocForActiveOrganization({ ctx, id: input.docId });
      const member = await getCurrentMember(ctx);

      const comment = await db.transaction(async (tx) => {
        if (input.parentId) {
          const parent = await openComment(tx, ctx, input.parentId, true);

          // Replies join a thread on this doc; they never nest.
          if (parent.doc.id !== doc.id || parent.parentId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Reply to a comment on this doc.",
            });
          }

          // A reply reopens a resolved thread.
          await tx
            .update(docComments)
            .set({ resolvedAt: null, updatedAt: new Date() })
            .where(eq(docComments.id, parent.id));
        }

        const [row] = await tx
          .insert(docComments)
          .values({
            organizationId: activeOrganization.id,
            docId: doc.id,
            authorMemberId: member.id,
            parentId: input.parentId ?? null,
            body: sanitizeRichText(input.body),
          })
          .returning();

        if (!row) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create comment.",
          });
        }

        await ctx.audit.record(tx, {
          action: "doc.comment_added",
          target: { id: doc.id, label: doc.title },
          projectId: doc.projectId,
          teamId: doc.teamId,
          metadata: { commentId: row.id, slug: doc.slug },
        });
        await syncMentions(tx, {
          organizationId: activeOrganization.id,
          memberId: member.id,
          source: { type: "doc", id: doc.id },
          text: input.body,
          via: "comment",
          mode: "append",
        });

        return row;
      });

      return comment;
    }),

  resolveComment: permissionProcedure("docs.comment", docByCommentId(), {
    module: "docs",
    audit: ["doc.comment_resolved"],
  })
    .input(resolveDocCommentSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const { doc, parentId } = await openComment(tx, ctx, input.id);

        if (parentId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Resolve the thread, not a reply.",
          });
        }

        const [comment] = await tx
          .update(docComments)
          .set({ resolvedAt: new Date(), updatedAt: new Date() })
          .where(
            and(eq(docComments.id, input.id), isNull(docComments.resolvedAt)),
          )
          .returning();

        if (!comment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Comment not found.",
          });
        }

        await ctx.audit.record(tx, {
          action: "doc.comment_resolved",
          target: { id: doc.id, label: doc.title },
          projectId: doc.projectId,
          teamId: doc.teamId,
          metadata: { commentId: comment.id, slug: doc.slug },
        });

        return comment;
      });
    }),

  editComment: permissionProcedure("docs.comment", docByCommentId(), {
    module: "docs",
    audit: ["doc.comment_edited"],
  })
    .input(updateDocCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const member = await getCurrentMember(ctx);

      return ctx.db.transaction(async (tx) => {
        const comment = await openComment(tx, ctx, input.id);

        // Only the author puts words in their own mouth.
        if (comment.authorMemberId !== member.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the author can edit a comment.",
          });
        }

        const [edited] = await tx
          .update(docComments)
          .set({ body: sanitizeRichText(input.body), updatedAt: new Date() })
          .where(eq(docComments.id, comment.id))
          .returning();

        await ctx.audit.record(tx, {
          action: "doc.comment_edited",
          target: { id: comment.doc.id, label: comment.doc.title },
          projectId: comment.doc.projectId,
          teamId: comment.doc.teamId,
          metadata: { commentId: comment.id, slug: comment.doc.slug },
        });
        await syncMentions(tx, {
          organizationId: ctx.activeOrganization.id,
          memberId: member.id,
          source: { type: "doc", id: comment.doc.id },
          text: input.body,
          via: "comment",
          mode: "append",
        });

        return edited!;
      });
    }),

  deleteComment: permissionProcedure("docs.comment", docByCommentId(), {
    module: "docs",
    audit: ["doc.comment_deleted"],
  })
    .input(deleteDocCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const member = await getCurrentMember(ctx);

      return ctx.db.transaction(async (tx) => {
        // Locked like a reply locks it, so a reply racing this delete
        // either lands first (and goes with the thread) or is refused.
        const comment = await openComment(tx, ctx, input.id, true);

        // Authors remove their own; people who may edit any doc moderate.
        if (comment.authorMemberId !== member.id) {
          await assertAnyPermission(ctx, ["docs.update_any"], {
            projectId: comment.doc.projectId,
            teamId: comment.doc.teamId,
          });
        }

        // A thread goes with its first comment.
        await tx
          .update(docComments)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              or(
                eq(docComments.id, comment.id),
                eq(docComments.parentId, comment.id),
              ),
              isNull(docComments.deletedAt),
            ),
          );

        await ctx.audit.record(tx, {
          action: "doc.comment_deleted",
          target: { id: comment.doc.id, label: comment.doc.title },
          projectId: comment.doc.projectId,
          teamId: comment.doc.teamId,
          metadata: { commentId: comment.id, slug: comment.doc.slug },
        });

        return { id: comment.id };
      });
    }),
};
