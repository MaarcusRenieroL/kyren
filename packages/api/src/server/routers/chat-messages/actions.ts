import { TRPCError } from "@trpc/server";
import { and, eq } from "@zentro/db/drizzle";
import { chatMessages, chatReactions } from "@zentro/db/schema";
import { z } from "zod";

import { channelAccess } from "../../chat";
import { loadMessage } from "./helpers";
import { chatProcedure, uuid } from "./types";

export const chatMessageActionProcedures = {
  /** Adds the reaction, or takes it back when it is already yours. */
  react: chatProcedure("chat.post")
    .input(z.object({ messageId: uuid, emoji: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const message = await loadMessage(ctx, input.messageId);
      const access = await channelAccess(ctx, message.channelId);

      if (!access.canPost || message.deletedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can't react here.",
        });
      }

      const removed = await ctx.db
        .delete(chatReactions)
        .where(
          and(
            eq(chatReactions.messageId, message.id),
            eq(chatReactions.memberId, access.memberId),
            eq(chatReactions.emoji, input.emoji),
          ),
        )
        .returning({ id: chatReactions.id });

      if (!removed.length) {
        await ctx.db
          .insert(chatReactions)
          .values({
            messageId: message.id,
            memberId: access.memberId,
            emoji: input.emoji,
          })
          .onConflictDoNothing();
      }

      return { reacted: !removed.length };
    }),

  pin: chatProcedure("chat.post")
    .input(z.object({ messageId: uuid, pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const message = await loadMessage(ctx, input.messageId);
      const access = await channelAccess(ctx, message.channelId);

      if (!access.membership || !access.canPost || message.deletedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Join the channel to pin messages.",
        });
      }

      if (
        !input.pinned &&
        message.pinnedByMemberId &&
        message.pinnedByMemberId !== access.memberId &&
        !access.canManage
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only whoever pinned it or a channel admin can unpin this.",
        });
      }

      await ctx.db
        .update(chatMessages)
        .set({
          pinnedAt: input.pinned ? new Date() : null,
          pinnedByMemberId: input.pinned ? access.memberId : null,
        })
        .where(eq(chatMessages.id, message.id));

      return { ok: true };
    }),
};
