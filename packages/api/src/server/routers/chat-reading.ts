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
} from "../chat";
import { hydrateMessages } from "./chat-messages";
import { uuid, chatProcedure, channelLabels } from "./chat-extras-shared";

export const chatReadingProcedures = {
  // ── Unread, read receipts and typing ────────────────────────────────────

  /** Marks a conversation unread from a message on. */
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
  threads: chatProcedure("chat.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const readable = await readableChannelIds(ctx, memberId);

    if (!readable.length) return [];

    const follows = await ctx.db
      .select()
      .from(chatThreadFollows)
      .where(eq(chatThreadFollows.memberId, memberId));
    const unfollowed = new Set(
      follows.filter((row) => !row.following).map((row) => row.parentId),
    );
    const followed = new Set(
      follows.filter((row) => row.following).map((row) => row.parentId),
    );
    // Threads started by, or replied in by, the caller count as followed
    // until they say otherwise.
    const mine = await ctx.db
      .select({ parentId: chatMessages.parentId, id: chatMessages.id })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.authorMemberId, memberId),
          inArray(chatMessages.channelId, readable),
          isNull(chatMessages.deletedAt),
        ),
      )
      .limit(500);

    for (const row of mine) {
      if (row.parentId) followed.add(row.parentId);
    }

    const withReplies = mine.length
      ? await ctx.db
          .selectDistinct({ parentId: chatMessages.parentId })
          .from(chatMessages)
          .where(
            and(
              inArray(
                chatMessages.parentId,
                mine.map((row) => row.id),
              ),
              isNull(chatMessages.deletedAt),
            ),
          )
      : [];

    for (const row of withReplies) {
      if (row.parentId) followed.add(row.parentId);
    }

    const parentIds = [...followed].filter((id) => !unfollowed.has(id));

    if (!parentIds.length) return [];

    const parents = await ctx.db
      .select()
      .from(chatMessages)
      .where(
        and(
          inArray(chatMessages.id, parentIds),
          inArray(chatMessages.channelId, readable),
          isNull(chatMessages.deletedAt),
        ),
      );
    const replies = await ctx.db
      .select({
        parentId: chatMessages.parentId,
        authorMemberId: chatMessages.authorMemberId,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(
        and(
          inArray(
            chatMessages.parentId,
            parents.map((row) => row.id),
          ),
          isNull(chatMessages.deletedAt),
        ),
      );
    const readAt = new Map(
      follows.map((row) => [row.parentId, row.lastReadAt]),
    );
    const views = await hydrateMessages(ctx, parents, memberId, {
      withReplies: true,
    });
    const labels = await channelLabels(
      ctx,
      parents.map((row) => row.channelId),
    );

    return views
      .map((view) => {
        const own = replies.filter((reply) => reply.parentId === view.id);
        const seen = readAt.get(view.id);
        const lastAt = own.reduce<Date | null>(
          (latest, reply) =>
            !latest || reply.createdAt > latest ? reply.createdAt : latest,
          null,
        );

        return {
          message: view,
          channelName: labels.get(view.channelId)?.name ?? null,
          kind: (labels.get(view.channelId)?.kind ?? "channel") as
            | "channel"
            | "dm",
          lastAt: lastAt ?? view.createdAt,
          unread: own.filter(
            (reply) =>
              reply.authorMemberId !== memberId &&
              (!seen || reply.createdAt > seen),
          ).length,
        };
      })
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
      .slice(0, 60);
  }),

  followThread: chatProcedure("chat.view")
    .input(z.object({ parentId: uuid, following: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const [parent] = await ctx.db
        .select({ channelId: chatMessages.channelId })
        .from(chatMessages)
        .where(eq(chatMessages.id, input.parentId))
        .limit(1);

      if (!parent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Thread not found.",
        });
      }

      await readableChannel(ctx, parent.channelId);
      await ctx.db
        .insert(chatThreadFollows)
        .values({
          memberId,
          parentId: input.parentId,
          following: input.following,
        })
        .onConflictDoUpdate({
          target: [chatThreadFollows.memberId, chatThreadFollows.parentId],
          set: { following: input.following },
        });

      return { ok: true };
    }),

  markThreadRead: chatProcedure("chat.view")
    .input(z.object({ parentId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      await ctx.db
        .insert(chatThreadFollows)
        .values({ memberId, parentId: input.parentId })
        .onConflictDoUpdate({
          target: [chatThreadFollows.memberId, chatThreadFollows.parentId],
          set: { lastReadAt: new Date() },
        });

      return { ok: true };
    }),

  /** Whether the caller follows a thread (explicitly or by taking part). */
  threadFollowing: chatProcedure("chat.view")
    .input(z.object({ parentId: uuid }))
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const [row] = await ctx.db
        .select({ following: chatThreadFollows.following })
        .from(chatThreadFollows)
        .where(
          and(
            eq(chatThreadFollows.memberId, memberId),
            eq(chatThreadFollows.parentId, input.parentId),
          ),
        )
        .limit(1);

      return { following: row?.following ?? true };
    }),
};
