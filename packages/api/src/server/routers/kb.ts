import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, or, type SQL } from "@zentro/db/drizzle";
import { kbArticles } from "@zentro/db/schema";
import { slugify } from "@zentro/utils";
import { z } from "zod";

import { currentMemberId } from "../chat";
import { permissionProcedure, router } from "../trpc";

const procedure = (permission: string, audit?: string[]) =>
  permissionProcedure(permission, undefined, { module: "tickets", audit });

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

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
          const [row] = await tx
            .update(kbArticles)
            .set(values)
            .where(
              and(
                eq(kbArticles.id, input.id),
                eq(kbArticles.organizationId, organizationId),
              ),
            )
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
