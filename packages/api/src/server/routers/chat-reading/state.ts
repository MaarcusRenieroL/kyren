import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, isNull, ne } from "@zentro/db/drizzle";
import {
  chatMembers,
  chatMessages,
  chatThreadFollows,
} from "@zentro/db/schema";
import { z } from "zod";
import {
  currentMemberId,
  memberProfiles,
  readableChannel,
  readableChannelIds,
} from "../../chat";
import { hydrateMessages } from "../chat-messages";
import { uuid, chatProcedure, channelLabels } from "../chat-extras-shared";


export const chatReadingStateProcedures = {
  markUnread: chatProcedure("chat.view")
    .input(z.object({ channelId: uuid, messageId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const access = await readableChannel(ctx, input.channelId);
      const [message] = await ctx.db
        .select({ createdAt: chatMessages.createdAt })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.id, input.messageId),
            eq(chatMessages.channelId, input.channelId),
          ),
        )
        .limit(1);

      if (!message || !access.membership) return { ok: true };

      await ctx.db
        .update(chatMembers)
        .set({ lastReadAt: new Date(message.createdAt.getTime() - 1) })
        .where(
          and(
            eq(chatMembers.channelId, input.channelId),
            eq(chatMembers.memberId, access.memberId),
          ),
        );

      return { ok: true };
    }),

  /** Who has read up to when, for direct messages and small channels. */
  readState: chatProcedure("chat.view")
    .input(z.object({ channelId: uuid }))
    .query(async ({ ctx, input }) => {
      const access = await readableChannel(ctx, input.channelId);
      const rows = await ctx.db
        .select({
          memberId: chatMembers.memberId,
          lastReadAt: chatMembers.lastReadAt,
        })
        .from(chatMembers)
        .where(
          and(
            eq(chatMembers.channelId, input.channelId),
            ne(chatMembers.memberId, access.memberId),
          ),
        )
        .limit(13);

      // Large channels do not show read receipts.
      if (rows.length > 12) return [];

      const profiles = await memberProfiles(
        ctx,
        rows.map((row) => row.memberId),
      );

      return rows.map((row) => ({
        memberId: row.memberId,
        name: profiles.get(row.memberId)?.name ?? "Someone",
        lastReadAt: row.lastReadAt,
      }));
    }),

  typing: chatProcedure("chat.post")
    .input(z.object({ channelId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      await ctx.db
        .update(chatMembers)
        .set({ typingAt: new Date() })
        .where(
          and(
            eq(chatMembers.channelId, input.channelId),
            eq(chatMembers.memberId, memberId),
          ),
        );

      return { ok: true };
    }),

  typingNow: chatProcedure("chat.view")
    .input(z.object({ channelId: uuid }))
    .query(async ({ ctx, input }) => {
      const access = await readableChannel(ctx, input.channelId);
      const rows = await ctx.db
        .select({ memberId: chatMembers.memberId })
        .from(chatMembers)
        .where(
          and(
            eq(chatMembers.channelId, input.channelId),
            ne(chatMembers.memberId, access.memberId),
            gt(chatMembers.typingAt, new Date(Date.now() - 6000)),
          ),
        );
      const profiles = await memberProfiles(
        ctx,
        rows.map((row) => row.memberId),
      );

      return rows
        .map((row) => profiles.get(row.memberId)?.name)
        .filter((name): name is string => Boolean(name));
    }),

  // ── Followed threads ────────────────────────────────────────────────────

  /** Threads the caller follows, started, or replied in, newest activity first. */
};
