import { TRPCError } from "@trpc/server";
import { buildChanges } from "@zentro/audit";
import { and, eq, isNull, sql } from "@zentro/db/drizzle";
import { docs } from "@zentro/db/schema";
import { z } from "zod";

import {
  updateDocContentSchema,
  updateDocTitleSchema,
} from "../../../types/zod-schema";
import { hasRecentDocEdit, recordDocVersion } from "../../access";
import { newShareToken } from "../../doc-share";
import { syncMentions } from "../../mentions";
import { docById } from "../../resources";
import { permissionProcedure } from "../../trpc";
import { getCurrentMember } from "../task-helpers";
import { getDocForActiveOrganization, shareOf } from "./helpers";

export const docEditProcedures = {
  updateDocTitle: permissionProcedure("docs.update_own", docById("id"), {
    module: "docs",
    audit: ["doc.updated"],
  })
    .input(updateDocTitleSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;
      const { id, title } = input;

      return db.transaction(async (tx) => {
        const [previous] = await tx
          .select({ title: docs.title })
          .from(docs)
          .where(
            and(
              eq(docs.id, id),
              eq(docs.organizationId, activeOrganization.id),
              isNull(docs.deletedAt),
            ),
          )
          .limit(1);

        const [updatedDoc] = await tx
          .update(docs)
          .set({
            title,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(docs.id, id),
              eq(docs.organizationId, activeOrganization.id),
              isNull(docs.deletedAt),
            ),
          )
          .returning();

        if (!updatedDoc) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Doc not found.",
          });
        }

        if (
          await hasRecentDocEdit(tx, {
            organizationId: activeOrganization.id,
            docId: updatedDoc.id,
            userId: user.id,
          })
        ) {
          ctx.audit.skipped("doc.updated");
        } else {
          await ctx.audit.record(tx, {
            action: "doc.updated",
            target: { id: updatedDoc.id, label: updatedDoc.title },
            projectId: updatedDoc.projectId,
            teamId: updatedDoc.teamId,
            metadata: { slug: updatedDoc.slug },
            changes: buildChanges(
              { title: previous?.title },
              { title: updatedDoc.title },
            ),
          });
        }

        return updatedDoc;
      });
    }),

  /**
   * Turns the doc's public, read-only link on or off. Turning it off and on
   * again makes a new link, so an old one never comes back to life.
   */
  setShare: permissionProcedure("docs.update_own", docById("id"), {
    module: "docs",
    audit: ["doc.shared", "doc.unshared"],
  })
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocForActiveOrganization({ ctx, id: input.id });
      const share = await shareOf(ctx, doc.id);
      const member = await getCurrentMember(ctx);
      const token = input.enabled
        ? (share.shareToken ?? newShareToken())
        : null;

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(docs)
          .set({
            shareToken: token,
            sharedAt: token ? (share.sharedAt ?? new Date()) : null,
            sharedByMemberId: token
              ? (share.sharedByMemberId ?? member.id)
              : null,
          })
          .where(eq(docs.id, doc.id));
        await ctx.audit.record(tx, {
          action: input.enabled ? "doc.shared" : "doc.unshared",
          target: { id: doc.id, label: doc.title },
          projectId: doc.projectId,
          teamId: doc.teamId,
        });
      });

      return { shared: Boolean(token), token };
    }),

  updateDocContent: permissionProcedure("docs.update_own", docById("id"), {
    module: "docs",
    audit: ["doc.updated"],
  })
    .input(updateDocContentSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, activeOrganization } = ctx;
      const { id, content, expectedUpdatedAt } = input;
      const member = await getCurrentMember(ctx);

      return db.transaction(async (tx) => {
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
              // Only overwrite the version this edit started from.
              ...(expectedUpdatedAt
                ? [
                    // Stored with microseconds; the client copy has milliseconds.
                    sql`date_trunc('milliseconds', ${docs.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`,
                  ]
                : []),
            ),
          )
          .returning();

        if (!updatedDoc) {
          throw new TRPCError({
            code: expectedUpdatedAt ? "CONFLICT" : "NOT_FOUND",
            message: expectedUpdatedAt
              ? "Someone else changed this doc. Reload to see their edits."
              : "Doc not found.",
          });
        }

        await recordDocVersion(tx, {
          organizationId: activeOrganization.id,
          docId: updatedDoc.id,
          memberId: member.id,
          content,
        });

        if (
          await hasRecentDocEdit(tx, {
            organizationId: activeOrganization.id,
            docId: updatedDoc.id,
            userId: user.id,
          })
        ) {
          ctx.audit.skipped("doc.updated");
        } else {
          await ctx.audit.record(tx, {
            action: "doc.updated",
            target: { id: updatedDoc.id, label: updatedDoc.title },
            projectId: updatedDoc.projectId,
            teamId: updatedDoc.teamId,
            metadata: {
              slug: updatedDoc.slug,
              fields: ["content"],
            },
          });
        }

        // Task keys named in the doc link the doc to those tasks.
        await syncMentions(tx, {
          organizationId: activeOrganization.id,
          memberId: member.id,
          source: { type: "doc", id: updatedDoc.id },
          text: content,
          via: "content",
          mode: "replace",
        });

        return updatedDoc;
      });
    }),
};
