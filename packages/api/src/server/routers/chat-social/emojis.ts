import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, sql } from "@kyren/db/drizzle";
import {
  chatEmojis,
  chatLinkPreviews,
  chatMessages,
  chatPolls,
  chatPollVotes,
  files,
} from "@kyren/db/schema";
import { z } from "zod";
import { postChatMessage } from "../../chat-post";
import { externalUrls, fetchPreview } from "../../chat-unfurl";
import { currentMemberId, readableChannel } from "../../chat";
import {
  uuid,
  chatProcedure,
  postableChannel,
  EMOJI_NAME,
  assertThreadParent,
} from "../chat-extras-shared";


export const chatEmojisProcedures = {
  emojiList: chatProcedure("chat.view").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ name: chatEmojis.name, fileId: chatEmojis.fileId })
      .from(chatEmojis)
      .where(eq(chatEmojis.organizationId, ctx.activeOrganization.id))
      .orderBy(asc(chatEmojis.name));

    return rows.map((row) => ({
      name: row.name,
      url: `/api/files/${row.fileId}`,
    }));
  }),

  emojiCreate: chatProcedure("chat.post", { also: ["chat.files.upload"] })
    .input(
      z.object({ name: z.string().trim().toLowerCase().max(64), fileId: uuid }),
    )
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      if (!EMOJI_NAME.test(input.name)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use 2-32 letters, numbers, dashes or underscores.",
        });
      }

      const [file] = await ctx.db
        .select({ id: files.id, mimeType: files.mimeType, size: files.size })
        .from(files)
        .where(
          and(
            eq(files.id, input.fileId),
            eq(files.organizationId, ctx.activeOrganization.id),
            eq(files.uploadedByMemberId, memberId),
            isNull(files.deletedAt),
          ),
        )
        .limit(1);

      if (
        !file ||
        !file.mimeType.startsWith("image/") ||
        file.size > 256 * 1024
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload an image under 256 KB.",
        });
      }

      const inserted = await ctx.db
        .insert(chatEmojis)
        .values({
          organizationId: ctx.activeOrganization.id,
          name: input.name,
          fileId: input.fileId,
          createdByMemberId: memberId,
        })
        .onConflictDoNothing()
        .returning({ id: chatEmojis.id });

      if (!inserted.length) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That emoji name is taken.",
        });
      }

      return { ok: true };
    }),

  emojiDelete: chatProcedure("chat.channels.manage")
    .input(z.object({ name: z.string().max(40) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(chatEmojis)
        .where(
          and(
            eq(chatEmojis.organizationId, ctx.activeOrganization.id),
            eq(chatEmojis.name, input.name),
          ),
        );

      return { ok: true };
    }),
};
