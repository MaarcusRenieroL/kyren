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
} from "@zentro/db/drizzle";
import {
  kbArticleRevisions,
  kbArticles,
  members,
  users,
} from "@zentro/db/schema";
import { slugify } from "@zentro/utils";
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


export const kbTrashProcedures = {
  /** Moves an article to the trash: off the help centre, restorable. */
  remove: procedure("tickets.manage_articles", ["article.deleted"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const before = await lockArticle(
          tx,
          input.id,
          ctx.activeOrganization.id,
        );

        await tx
          .update(kbArticles)
          .set({ deletedAt: new Date() })
          .where(eq(kbArticles.id, before.id));
        await ctx.audit.record(tx, {
          action: "article.deleted",
          target: { id: before.id, label: before.title },
        });

        return { ok: true };
      }),
    ),

  /** Takes an article out of the trash, as it was. */
  untrash: procedure("tickets.manage_articles", ["article.recovered"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .update(kbArticles)
          .set({ deletedAt: null })
          .where(
            and(
              eq(kbArticles.id, input.id),
              eq(kbArticles.organizationId, ctx.activeOrganization.id),
              isNotNull(kbArticles.deletedAt),
            ),
          )
          .returning({ id: kbArticles.id, title: kbArticles.title });

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "article.recovered",
          target: { id: row.id, label: row.title },
        });

        return { ok: true };
      }),
    ),

  /** Deletes a trashed article and its earlier versions for good. */
  purge: procedure("tickets.manage_articles", ["article.purged"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .delete(kbArticles)
          .where(
            and(
              eq(kbArticles.id, input.id),
              eq(kbArticles.organizationId, ctx.activeOrganization.id),
              // Only from the trash, so nothing live vanishes in one click.
              isNotNull(kbArticles.deletedAt),
            ),
          )
          .returning({ id: kbArticles.id, title: kbArticles.title });

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "article.purged",
          target: { id: row.id, label: row.title },
        });

        return { ok: true };
      }),
    ),
};
