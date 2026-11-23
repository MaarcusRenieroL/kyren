import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  type SQL,
} from "@kyren/db/drizzle";
import {
  kbArticleRevisions,
  kbArticles,
  members,
  users,
} from "@kyren/db/schema";
import { slugify } from "@kyren/utils";
import { z } from "zod";

import { currentMemberId } from "../../chat";
import { permissionProcedure, router, type OrganizationContext } from "../../trpc";

const procedure = (permission: string, audit?: string[]) =>
  permissionProcedure(permission, undefined, { module: "tickets", audit });

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

type Tx = Parameters<
  Parameters<OrganizationContext["db"]["transaction"]>[0]
>[0];
type Article = typeof kbArticles.$inferSelect;

/** Keeps the article as it is now, before it changes. */
const keepRevision = (tx: Tx, article: Article) =>
  tx.insert(kbArticleRevisions).values({
    articleId: article.id,
    title: article.title,
    body: article.body,
    status: article.status,
    audience: article.audience,
    editedByMemberId: article.updatedByMemberId,
    editedAt: article.updatedAt,
  });

/** The article, locked for this transaction, if it is in the organization. */
async function lockArticle(tx: Tx, id: string, organizationId: string) {
  const [row] = await tx
    .select()
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.id, id),
        eq(kbArticles.organizationId, organizationId),
        // An article in the trash takes no edits until it is restored.
        isNull(kbArticles.deletedAt),
      ),
    )
    .for("update")
    .limit(1);

  if (!row) throw new TRPCError({ code: "NOT_FOUND" });

  return row;
}

const articleInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(150),
  body: z.string().max(20_000),
  status: z.enum(["draft", "published"]),
  audience: z.enum(["internal", "public"]),
});



export const kbRevisionsProcedures = {
  revisions: procedure("tickets.view")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [article] = await ctx.db
        .select({ id: kbArticles.id })
        .from(kbArticles)
        .where(
          and(
            eq(kbArticles.id, input.id),
            eq(kbArticles.organizationId, ctx.activeOrganization.id),
            isNull(kbArticles.deletedAt),
          ),
        )
        .limit(1);

      if (!article) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db
        .select({
          id: kbArticleRevisions.id,
          title: kbArticleRevisions.title,
          body: kbArticleRevisions.body,
          status: kbArticleRevisions.status,
          audience: kbArticleRevisions.audience,
          editedAt: kbArticleRevisions.editedAt,
          editedBy: users.name,
        })
        .from(kbArticleRevisions)
        .leftJoin(members, eq(members.id, kbArticleRevisions.editedByMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(eq(kbArticleRevisions.articleId, article.id))
        .orderBy(desc(kbArticleRevisions.createdAt))
        .limit(50);
    }),

  /**
   * Brings back an earlier version's title and text. Who can see the article
   * (status and audience) stays as it is now, so a restore never republishes
   * something that was taken down. The current text is kept first, so a
   * restore can itself be undone.
   */
  restoreRevision: procedure("tickets.manage_articles", ["article.restored"])
    .input(z.object({ revisionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const memberId = await currentMemberId(ctx);

      return ctx.db.transaction(async (tx) => {
        const [revision] = await tx
          .select({
            articleId: kbArticleRevisions.articleId,
            title: kbArticleRevisions.title,
            body: kbArticleRevisions.body,
          })
          .from(kbArticleRevisions)
          .innerJoin(
            kbArticles,
            eq(kbArticles.id, kbArticleRevisions.articleId),
          )
          .where(
            and(
              eq(kbArticleRevisions.id, input.revisionId),
              eq(kbArticles.organizationId, organizationId),
            ),
          )
          .limit(1);

        if (!revision) throw new TRPCError({ code: "NOT_FOUND" });

        const before = await lockArticle(
          tx,
          revision.articleId,
          organizationId,
        );

        await keepRevision(tx, before);

        const [row] = await tx
          .update(kbArticles)
          .set({
            title: revision.title,
            body: revision.body,
            updatedByMemberId: memberId,
            updatedAt: new Date(),
          })
          .where(eq(kbArticles.id, before.id))
          .returning();

        await ctx.audit.record(tx, {
          action: "article.restored",
          target: { id: row!.id, label: row!.title },
        });

        return row!;
      });
    }),

};
