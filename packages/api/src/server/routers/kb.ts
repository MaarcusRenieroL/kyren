import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, or, type SQL } from "@zentro/db/drizzle";
import {
  kbArticleRevisions,
  kbArticles,
  members,
  users,
} from "@zentro/db/schema";
import { slugify } from "@zentro/utils";
import { z } from "zod";

import { currentMemberId } from "../chat";
import { permissionProcedure, router, type OrganizationContext } from "../trpc";

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
      and(eq(kbArticles.id, id), eq(kbArticles.organizationId, organizationId)),
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

export const kbRouter = router({
  /** Every article of the organization, newest edit first. */
  list: procedure("tickets.view")
    .input(z.object({}))
    .query(({ ctx }) =>
      ctx.db
        .select()
        .from(kbArticles)
        .where(eq(kbArticles.organizationId, ctx.activeOrganization.id))
        .orderBy(desc(kbArticles.updatedAt), asc(kbArticles.title)),
    ),

  /** Published articles that mention every word of the question (for an agent writing a reply). */
  suggest: procedure("tickets.view")
    .input(z.object({ query: z.string().trim().min(1).max(200) }))
    .query(({ ctx, input }) => {
      const words = input.query.split(/\s+/).slice(0, 6);
      const matches: SQL[] = words.map(
        (word) =>
          or(
            ilike(kbArticles.title, `%${escapeLike(word)}%`),
            ilike(kbArticles.body, `%${escapeLike(word)}%`),
          )!,
      );

      return ctx.db
        .select({
          id: kbArticles.id,
          title: kbArticles.title,
          slug: kbArticles.slug,
          body: kbArticles.body,
          audience: kbArticles.audience,
        })
        .from(kbArticles)
        .where(
          and(
            eq(kbArticles.organizationId, ctx.activeOrganization.id),
            eq(kbArticles.status, "published"),
            ...matches,
          ),
        )
        .orderBy(asc(kbArticles.title))
        .limit(5);
    }),

  save: procedure("tickets.manage_articles", ["article.saved"])
    .input(articleInput)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const memberId = await currentMemberId(ctx);

      return ctx.db.transaction(async (tx) => {
        const values = {
          title: input.title,
          body: input.body,
          status: input.status,
          audience: input.audience,
          updatedByMemberId: memberId,
          updatedAt: new Date(),
        };

        if (input.id) {
          const before = await lockArticle(tx, input.id, organizationId);
          const changed =
            before.title !== input.title ||
            before.body !== input.body ||
            before.status !== input.status ||
            before.audience !== input.audience;

          if (!changed) {
            await ctx.audit.record(tx, {
              action: "article.saved",
              target: { id: before.id, label: before.title },
            });

            return before;
          }

          await keepRevision(tx, before);

          const [row] = await tx
            .update(kbArticles)
            .set(values)
            .where(eq(kbArticles.id, before.id))
            .returning();

          if (!row) throw new TRPCError({ code: "NOT_FOUND" });

          await ctx.audit.record(tx, {
            action: "article.saved",
            target: { id: row.id, label: row.title },
          });

          return row;
        }

        const base = slugify(input.title) || "article";
        const taken = new Set(
          (
            await tx
              .select({ slug: kbArticles.slug })
              .from(kbArticles)
              .where(eq(kbArticles.organizationId, organizationId))
          ).map((r) => r.slug),
        );
        let slug = base;

        for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

        const [row] = await tx
          .insert(kbArticles)
          .values({ ...values, organizationId, slug })
          .returning();

        await ctx.audit.record(tx, {
          action: "article.saved",
          target: { id: row!.id, label: row!.title },
        });

        return row!;
      });
    }),

  /** Earlier versions of an article, newest first. */
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

  remove: procedure("tickets.manage_articles", ["article.deleted"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .delete(kbArticles)
          .where(
            and(
              eq(kbArticles.id, input.id),
              eq(kbArticles.organizationId, ctx.activeOrganization.id),
            ),
          )
          .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "article.deleted",
          target: { id: row.id, label: row.title },
        });

        return { ok: true };
      }),
    ),
});
