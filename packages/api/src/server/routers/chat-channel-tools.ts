import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, sql } from "@zentro/db/drizzle";
import {
  chatBookmarks,
  chatChannels,
  chatMessages,
  chatStatuses,
} from "@zentro/db/schema";
import { z } from "zod";
import { postChatMessage } from "../chat-post";
import {
  currentMemberId,
  memberProfiles,
  plainBody,
  readableChannel,
} from "../chat";
import {
  uuid,
  chatProcedure,
  postableChannel,
  manageableChannel,
} from "./chat-extras-shared";

export const chatChannelToolProcedures = {
  // ── Status and do not disturb ───────────────────────────────────────────

  statusGet: chatProcedure("chat.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const profile = (await memberProfiles(ctx, [memberId])).get(memberId);
    const [row] = await ctx.db
      .select()
      .from(chatStatuses)
      .where(eq(chatStatuses.memberId, memberId))
      .limit(1);

    return {
      emoji: profile?.status?.emoji ?? null,
      text: profile?.status?.text ?? null,
      expiresAt: profile?.status ? (row?.expiresAt ?? null) : null,
      dndUntil: profile?.dnd ? (row?.dndUntil ?? null) : null,
    };
  }),

  statusSet: chatProcedure("chat.view")
    .input(
      z.object({
        emoji: z.string().max(16).nullable(),
        text: z.string().trim().max(80).nullable(),
        /** Minutes until the status clears; null keeps it. */
        clearInMinutes: z
          .number()
          .int()
          .min(1)
          .max(60 * 24 * 14)
          .nullable(),
        /** Minutes of do not disturb; 0 turns it off; null leaves it. */
        dndMinutes: z
          .number()
          .int()
          .min(0)
          .max(60 * 24 * 7)
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const [existing] = await ctx.db
        .select()
        .from(chatStatuses)
        .where(eq(chatStatuses.memberId, memberId))
        .limit(1);
      const now = Date.now();
      const values = {
        emoji: input.emoji,
        text: input.text,
        expiresAt: input.clearInMinutes
          ? new Date(now + input.clearInMinutes * 60_000)
          : null,
        dndUntil:
          input.dndMinutes === null
            ? (existing?.dndUntil ?? null)
            : input.dndMinutes === 0
              ? null
              : new Date(now + input.dndMinutes * 60_000),
        updatedAt: new Date(),
      };

      await ctx.db
        .insert(chatStatuses)
        .values({ memberId, ...values })
        .onConflictDoUpdate({ target: chatStatuses.memberId, set: values });

      return { ok: true };
    }),

  // ── Channel extras: canvas, bookmarks, retention, huddles, export ───────

  setCanvas: chatProcedure("chat.post")
    .input(z.object({ channelId: uuid, canvas: z.string().max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const access = await postableChannel(ctx, input.channelId);

      if (!access.membership && !access.canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Join the channel to edit its note.",
        });
      }

      await ctx.db
        .update(chatChannels)
        .set({ canvas: input.canvas.trim() || null, updatedAt: new Date() })
        .where(eq(chatChannels.id, input.channelId));

      return { ok: true };
    }),

  bookmarks: chatProcedure("chat.view")
    .input(z.object({ channelId: uuid }))
    .query(async ({ ctx, input }) => {
      await readableChannel(ctx, input.channelId);

      return ctx.db
        .select({
          id: chatBookmarks.id,
          title: chatBookmarks.title,
          url: chatBookmarks.url,
        })
        .from(chatBookmarks)
        .where(eq(chatBookmarks.channelId, input.channelId))
        .orderBy(asc(chatBookmarks.position), asc(chatBookmarks.createdAt));
    }),

  addBookmark: chatProcedure("chat.post")
    .input(
      z.object({
        channelId: uuid,
        title: z.string().trim().min(1).max(80),
        url: z
          .string()
          .trim()
          .max(500)
          .refine(
            (value) => /^https?:\/\//.test(value) || value.startsWith("/"),
            "Use a web address or a page in Zentro.",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await postableChannel(ctx, input.channelId);

      if (!access.membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Join the channel to add bookmarks.",
        });
      }

      const [{ count } = { count: 0 }] = await ctx.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(chatBookmarks)
        .where(eq(chatBookmarks.channelId, input.channelId));

      if (count >= 12) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A channel can have up to 12 bookmarks.",
        });
      }

      await ctx.db.insert(chatBookmarks).values({
        channelId: input.channelId,
        title: input.title,
        url: input.url,
        position: count,
        createdByMemberId: access.memberId,
      });

      return { ok: true };
    }),

  removeBookmark: chatProcedure("chat.post")
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ channelId: chatBookmarks.channelId })
        .from(chatBookmarks)
        .where(eq(chatBookmarks.id, input.id))
        .limit(1);

      if (!row) return { ok: true };

      const access = await postableChannel(ctx, row.channelId);

      if (!access.membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Join first." });
      }

      await ctx.db.delete(chatBookmarks).where(eq(chatBookmarks.id, input.id));

      return { ok: true };
    }),

  setRetention: chatProcedure("chat.post", { audit: ["chat.channel_updated"] })
    .input(
      z.object({
        channelId: uuid,
        days: z.number().int().min(1).max(3650).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await manageableChannel(ctx, input.channelId);

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(chatChannels)
          .set({ retentionDays: input.days, updatedAt: new Date() })
          .where(eq(chatChannels.id, input.channelId));
        await ctx.audit.record(tx, {
          action: "chat.channel_updated",
          target: {
            id: input.channelId,
            label: `#${access.channel.name ?? "channel"}`,
          },
          metadata: { fields: ["retention"] },
        });
      });

      return { ok: true };
    }),

  /** Starts a video room and posts its link to the conversation. */
  startHuddle: chatProcedure("chat.post")
    .input(z.object({ channelId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const access = await postableChannel(ctx, input.channelId);
      const room = `zentro-${input.channelId.slice(0, 8)}-${Date.now().toString(36)}`;
      const url = `https://meet.jit.si/${room}`;
      const message = await ctx.db.transaction((tx) =>
        postChatMessage(tx, {
          organizationId: ctx.activeOrganization.id,
          channelId: input.channelId,
          memberId: access.memberId,
          body: "Started a huddle",
          kind: "huddle",
          meta: { url },
          join: !access.membership,
        }),
      );

      return { messageId: message.id, url };
    }),

  /** Every message in a channel, oldest first, for a download. */
  exportChannel: chatProcedure("chat.post")
    .input(z.object({ channelId: uuid }))
    .query(async ({ ctx, input }) => {
      const access = await manageableChannel(ctx, input.channelId);
      const rows = await ctx.db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.channelId, input.channelId),
            isNull(chatMessages.deletedAt),
          ),
        )
        .orderBy(asc(chatMessages.createdAt))
        .limit(20_000);
      const profiles = await memberProfiles(
        ctx,
        rows
          .map((row) => row.authorMemberId)
          .filter((id): id is string => Boolean(id)),
      );
      const mentionNames = new Map(
        [...profiles.values()].map((profile) => [
          profile.memberId,
          profile.name,
        ]),
      );

      return {
        channel: access.channel.name ?? "direct-message",
        exportedAt: new Date(),
        messages: rows.map((row) => ({
          id: row.id,
          at: row.createdAt,
          author:
            (row.authorMemberId
              ? profiles.get(row.authorMemberId)?.name
              : null) ?? "Someone",
          inThread: Boolean(row.parentId),
          text: plainBody(row.body, mentionNames),
        })),
      };
    }),

  // ── Forwarding ──────────────────────────────────────────────────────────

  forward: chatProcedure("chat.post")
    .input(
      z.object({
        messageId: uuid,
        channelId: uuid,
        note: z.string().trim().max(2000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [source] = await ctx.db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.id, input.messageId),
            eq(chatMessages.organizationId, ctx.activeOrganization.id),
            isNull(chatMessages.deletedAt),
          ),
        )
        .limit(1);

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      }

      await readableChannel(ctx, source.channelId);

      const access = await postableChannel(ctx, input.channelId);
      const message = await ctx.db.transaction((tx) =>
        postChatMessage(tx, {
          organizationId: ctx.activeOrganization.id,
          channelId: input.channelId,
          memberId: access.memberId,
          body: input.note,
          forwardedFromId: source.id,
          join: !access.membership,
        }),
      );

      return { messageId: message.id };
    }),
};
