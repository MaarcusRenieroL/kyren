import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "@zentro/db/drizzle";
import { docComments, docs } from "@zentro/db/schema";

import type { TRPCContext } from "../../../types";
import { type DbHandle } from "../../access";

/** A live comment of the active organization, with the doc it sits on. */
export async function openComment(
  tx: DbHandle,
  ctx: { activeOrganization: { id: string } },
  id: string,
  /** Lock the row until the transaction ends (a reply racing a delete). */
  lock = false,
) {
  const query = tx
    .select({
      id: docComments.id,
      authorMemberId: docComments.authorMemberId,
      parentId: docComments.parentId,
      doc: {
        id: docs.id,
        title: docs.title,
        slug: docs.slug,
        projectId: docs.projectId,
        teamId: docs.teamId,
      },
    })
    .from(docComments)
    .innerJoin(docs, eq(docs.id, docComments.docId))
    .where(
      and(
        eq(docComments.id, id),
        eq(docComments.organizationId, ctx.activeOrganization.id),
        isNull(docComments.deletedAt),
        isNull(docs.deletedAt),
      ),
    )
    .limit(1);
  const [row] = lock
    ? await query.for("update", { of: docComments })
    : await query;

  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found." });
  }

  return row;
}

/** A doc's public-link fields (the doc is already known to be in this org). */
export async function shareOf(ctx: { db: TRPCContext["db"] }, id: string) {
  const [row] = await ctx.db
    .select({
      shareToken: docs.shareToken,
      sharedAt: docs.sharedAt,
      sharedByMemberId: docs.sharedByMemberId,
    })
    .from(docs)
    .where(eq(docs.id, id))
    .limit(1);

  return row!;
}

export async function getDocForActiveOrganization({
  ctx,
  id,
}: {
  ctx: TRPCContext & {
    activeOrganization: NonNullable<TRPCContext["activeOrganization"]>;
  };
  id: string;
}) {
  const [doc] = await ctx.db
    .select({
      id: docs.id,
      title: docs.title,
      slug: docs.slug,
      projectId: docs.projectId,
      teamId: docs.teamId,
    })
    .from(docs)
    .where(
      and(
        eq(docs.id, id),
        eq(docs.organizationId, ctx.activeOrganization.id),
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
}

// A doc's text with Markdown marks and runs of whitespace taken out.
export const plainContent = sql`regexp_replace(regexp_replace(${docs.content}, '[[][ xX][]]|[#>\`*_|]+|-{2,}', ' ', 'g'), '[[:space:]]+', ' ', 'g')`;
