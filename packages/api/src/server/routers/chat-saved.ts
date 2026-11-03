import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull } from "@zentro/db/drizzle";
import {
  chatDrafts,
  chatMessages,
  chatSaved,
  chatScheduled,
} from "@zentro/db/schema";
import { z } from "zod";
import { currentMemberId, readableChannel, readableChannelIds } from "../chat";
import { hydrateMessages } from "./chat-messages";
import {
  uuid,
  chatProcedure,
  channelLabels,
  postableChannel,
  assertThreadParent,
} from "./chat-extras-shared";

export const chatSavedProcedures = {
  // ── Saved messages and reminders ────────────────────────────────────────

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

  draftGet: chatProcedure("chat.view")
    .input(z.object({ scope: z.string().max(80) }))
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const [draft] = await ctx.db
        .select({ body: chatDrafts.body })
        .from(chatDrafts)
        .where(
          and(
            eq(chatDrafts.memberId, memberId),
            eq(chatDrafts.scope, input.scope),
          ),
        )
        .limit(1);

      return { body: draft?.body ?? "" };
    }),

  /** Saves the unsent text of a composer; empty text clears the draft. */
  draftSet: chatProcedure("chat.view")
    .input(
      z.object({
        channelId: uuid,
        scope: z.string().max(80),
        body: z.string().max(10_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      if (!input.scope.startsWith(input.channelId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bad draft." });
      }

      if (!input.body.trim()) {
        await ctx.db
          .delete(chatDrafts)
          .where(
            and(
              eq(chatDrafts.memberId, memberId),
              eq(chatDrafts.scope, input.scope),
            ),
          );

        return { ok: true };
      }

      await readableChannel(ctx, input.channelId);
      await ctx.db
        .insert(chatDrafts)
        .values({
          memberId,
          channelId: input.channelId,
          scope: input.scope,
          body: input.body,
        })
        .onConflictDoUpdate({
          target: [chatDrafts.memberId, chatDrafts.scope],
          set: { body: input.body, updatedAt: new Date() },
        });

      return { ok: true };
    }),

  /** Every conversation the caller has an unsent draft in. */
  draftList: chatProcedure("chat.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const rows = await ctx.db
      .select()
      .from(chatDrafts)
      .where(eq(chatDrafts.memberId, memberId))
      .orderBy(desc(chatDrafts.updatedAt))
      .limit(50);
    const labels = await channelLabels(
      ctx,
      rows.map((row) => row.channelId),
    );

    return rows.map((row) => ({
      channelId: row.channelId,
      channelName: labels.get(row.channelId)?.name ?? null,
      kind: (labels.get(row.channelId)?.kind ?? "channel") as "channel" | "dm",
      inThread: row.scope.includes(":"),
      body: row.body,
      updatedAt: row.updatedAt,
    }));
  }),

  // ── Scheduled messages ──────────────────────────────────────────────────

  schedule: chatProcedure("chat.post")
    .input(
      z.object({
        channelId: uuid,
        parentId: uuid.optional(),
        body: z.string().trim().min(1).max(10_000),
        sendAt: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await postableChannel(ctx, input.channelId);

      await assertThreadParent(ctx, input.channelId, input.parentId);

      if (input.sendAt.getTime() < Date.now() + 30_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick a time in the future.",
        });
      }

      const [row] = await ctx.db
        .insert(chatScheduled)
        .values({
          organizationId: ctx.activeOrganization.id,
          memberId: access.memberId,
          channelId: input.channelId,
          parentId: input.parentId ?? null,
          body: input.body,
          sendAt: input.sendAt,
        })
        .returning({ id: chatScheduled.id });

      return { id: row!.id };
    }),

  scheduledList: chatProcedure("chat.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const rows = await ctx.db
      .select()
      .from(chatScheduled)
      .where(
        and(
          eq(chatScheduled.memberId, memberId),
          isNull(chatScheduled.sentAt),
          isNull(chatScheduled.canceledAt),
        ),
      )
      .orderBy(asc(chatScheduled.sendAt));
    const labels = await channelLabels(
      ctx,
      rows.map((row) => row.channelId),
    );

    return rows.map((row) => ({
      id: row.id,
      channelId: row.channelId,
      channelName: labels.get(row.channelId)?.name ?? null,
      kind: (labels.get(row.channelId)?.kind ?? "channel") as "channel" | "dm",
      body: row.body,
      sendAt: row.sendAt,
      inThread: Boolean(row.parentId),
    }));
  }),

  scheduledCancel: chatProcedure("chat.view")
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      await ctx.db
        .update(chatScheduled)
        .set({ canceledAt: new Date() })
        .where(
          and(
            eq(chatScheduled.id, input.id),
            eq(chatScheduled.memberId, memberId),
            isNull(chatScheduled.sentAt),
          ),
        );

      return { ok: true };
    }),
};
