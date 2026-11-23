import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, sql } from "@kyren/db/drizzle";
import {
  chatBookmarks,
  chatChannels,
  chatMessages,
  chatStatuses,
} from "@kyren/db/schema";
import { z } from "zod";
import { postChatMessage } from "../../chat-post";
import {
  currentMemberId,
  memberProfiles,
  plainBody,
  readableChannel,
} from "../../chat";
import {
  uuid,
  chatProcedure,
  postableChannel,
  manageableChannel,
} from "../chat-extras-shared";


export const chatChannelStatusProcedures = {
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

};
