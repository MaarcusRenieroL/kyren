import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNull,
  lt,
  lte,
  sql,
} from "@zentro/db/drizzle";
import { chatMessages } from "@zentro/db/schema";
import { z } from "zod";

import { readableChannel } from "../../chat";
import { hydrateMessages } from "./hydrate";
import { loadMessage } from "./helpers";
import { chatProcedure, PAGE, uuid, type Row } from "./types";

export const chatMessageQueryProcedures = {
  /** A page of top-level messages, oldest first; or the page around one. */
  messages: chatProcedure("chat.view")
    .input(
      z.object({
        channelId: uuid,
        before: z.coerce.date().optional(),
        aroundId: uuid.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const access = await readableChannel(ctx, input.channelId);
      const base = and(
        eq(chatMessages.channelId, input.channelId),
        isNull(chatMessages.parentId),
      );
      let rows: Row[];

      if (input.aroundId) {
        const anchor = await loadMessage(ctx, input.aroundId);
        const top = anchor.parentId
          ? await loadMessage(ctx, anchor.parentId)
          : anchor;

        if (
          anchor.channelId !== input.channelId ||
          top.channelId !== input.channelId
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Message not found.",
          });
        }

        const at = top.createdAt;
        const [older, newer] = await Promise.all([
          ctx.db
            .select()
            .from(chatMessages)
            .where(and(base, lte(chatMessages.createdAt, at)))
            .orderBy(desc(chatMessages.createdAt))
            .limit(PAGE / 2),
          ctx.db
            .select()
            .from(chatMessages)
            .where(and(base, gt(chatMessages.createdAt, at)))
            .orderBy(asc(chatMessages.createdAt))
            .limit(PAGE / 2),
        ]);

        rows = [...older.reverse(), ...newer];
      } else {
        rows = (
          await ctx.db
            .select()
            .from(chatMessages)
            .where(
              and(
                base,
                input.before
                  ? lt(chatMessages.createdAt, input.before)
                  : undefined,
              ),
            )
            .orderBy(desc(chatMessages.createdAt))
            .limit(PAGE + 1)
        ).reverse();
      }

      const hasMore = !input.aroundId && rows.length > PAGE;
      const page = hasMore ? rows.slice(1) : rows;

      return {
        messages: await hydrateMessages(ctx, page, access.memberId, {
          withReplies: true,
        }),
        hasMore: input.aroundId ? true : hasMore,
      };
    }),

  /** A thread: the first message and every reply. */
  thread: chatProcedure("chat.view")
    .input(z.object({ messageId: uuid }))
    .query(async ({ ctx, input }) => {
      const parent = await loadMessage(ctx, input.messageId);
      const access = await readableChannel(ctx, parent.channelId);
      const replies = await ctx.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.parentId, parent.id))
        .orderBy(asc(chatMessages.createdAt));
      const [head, ...rest] = await hydrateMessages(
        ctx,
        [parent, ...replies],
        access.memberId,
      );

      return { parent: head!, replies: rest };
    }),

  pins: chatProcedure("chat.view")
    .input(z.object({ channelId: uuid }))
    .query(async ({ ctx, input }) => {
      const access = await readableChannel(ctx, input.channelId);
      const rows = await ctx.db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.channelId, input.channelId),
            isNull(chatMessages.deletedAt),
            sql`${chatMessages.pinnedAt} is not null`,
          ),
        )
        .orderBy(desc(chatMessages.pinnedAt));

      return hydrateMessages(ctx, rows, access.memberId);
    }),
};
