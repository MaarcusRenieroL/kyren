import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull } from "@kyren/db/drizzle";
import {
  chatDrafts,
  chatMessages,
  chatSaved,
  chatScheduled,
} from "@kyren/db/schema";
import { z } from "zod";
import { currentMemberId, readableChannel, readableChannelIds } from "../../chat";
import { hydrateMessages } from "../chat-messages";
import {
  uuid,
  chatProcedure,
  channelLabels,
  postableChannel,
  assertThreadParent,
} from "../chat-extras-shared";


export const chatSavedItemsProcedures = {
  savedList: chatProcedure("chat.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const readable = new Set(await readableChannelIds(ctx, memberId));
    const rows = await ctx.db
      .select({ saved: chatSaved, message: chatMessages })
      .from(chatSaved)
      .innerJoin(chatMessages, eq(chatMessages.id, chatSaved.messageId))
      .where(
        and(eq(chatSaved.memberId, memberId), isNull(chatMessages.deletedAt)),
      )
      .orderBy(desc(chatSaved.createdAt))
      .limit(100);
    const visible = rows.filter((row) => readable.has(row.message.channelId));
    const views = await hydrateMessages(
      ctx,
      visible.map((row) => row.message),
      memberId,
    );
    const labels = await channelLabels(
      ctx,
      visible.map((row) => row.message.channelId),
    );
    const now = Date.now();

    return visible.map((row, index) => ({
      message: views[index]!,
      channelName: labels.get(row.message.channelId)?.name ?? null,
      remindAt: row.saved.remindAt,
      due: Boolean(
        row.saved.remindAt &&
        !row.saved.completedAt &&
        row.saved.remindAt.getTime() <= now,
      ),
      completedAt: row.saved.completedAt,
    }));
  }),

  saveMessage: chatProcedure("chat.view")
    .input(z.object({ messageId: uuid, saved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      if (!input.saved) {
        await ctx.db
          .delete(chatSaved)
          .where(
            and(
              eq(chatSaved.memberId, memberId),
              eq(chatSaved.messageId, input.messageId),
            ),
          );

        return { ok: true };
      }

      const [message] = await ctx.db
        .select({ channelId: chatMessages.channelId })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.id, input.messageId),
            eq(chatMessages.organizationId, ctx.activeOrganization.id),
            isNull(chatMessages.deletedAt),
          ),
        )
        .limit(1);

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      }

      await readableChannel(ctx, message.channelId);
      await ctx.db
        .insert(chatSaved)
        .values({ memberId, messageId: input.messageId })
        .onConflictDoNothing();

      return { ok: true };
    }),

  /** Remind the caller about a message at a time; saves it too. */
  setReminder: chatProcedure("chat.view")
    .input(z.object({ messageId: uuid, remindAt: z.coerce.date().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const [message] = await ctx.db
        .select({ channelId: chatMessages.channelId })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.id, input.messageId),
            eq(chatMessages.organizationId, ctx.activeOrganization.id),
            isNull(chatMessages.deletedAt),
          ),
        )
        .limit(1);

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      }

      await readableChannel(ctx, message.channelId);
      await ctx.db
        .insert(chatSaved)
        .values({
          memberId,
          messageId: input.messageId,
          remindAt: input.remindAt,
        })
        .onConflictDoUpdate({
          target: [chatSaved.memberId, chatSaved.messageId],
          set: {
            remindAt: input.remindAt,
            remindedAt: null,
            completedAt: null,
          },
        });

      return { ok: true };
    }),

  completeSaved: chatProcedure("chat.view")
    .input(z.object({ messageId: uuid, done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      await ctx.db
        .update(chatSaved)
        .set({ completedAt: input.done ? new Date() : null })
        .where(
          and(
            eq(chatSaved.memberId, memberId),
            eq(chatSaved.messageId, input.messageId),
          ),
        );

      return { ok: true };
    }),

  // ── Drafts ──────────────────────────────────────────────────────────────

};
