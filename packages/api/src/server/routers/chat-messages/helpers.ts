import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "@zentro/db/drizzle";
import { chatAttachments, chatMessages, files } from "@zentro/db/schema";

import { type OrganizationContext } from "../../trpc";

export async function loadMessage(
  ctx: OrganizationContext,
  messageId: string,
) {
  const [row] = await ctx.db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.id, messageId),
        eq(chatMessages.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Message not found." });
  }

  return row;
}

/** Files the caller uploaded and has not attached anywhere yet. */
export async function claimFiles(
  ctx: OrganizationContext,
  memberId: string,
  fileIds: string[],
) {
  if (!fileIds.length) return [];

  const rows = await ctx.db
    .select({ id: files.id })
    .from(files)
    .leftJoin(chatAttachments, eq(chatAttachments.fileId, files.id))
    .where(
      and(
        inArray(files.id, fileIds),
        eq(files.organizationId, ctx.activeOrganization.id),
        eq(files.uploadedByMemberId, memberId),
        isNull(files.deletedAt),
        isNull(chatAttachments.id),
      ),
    );
  const owned = new Set(rows.map((row) => row.id));

  return fileIds.filter((id) => owned.has(id));
}
