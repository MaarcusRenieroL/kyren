import { TRPCError } from "@trpc/server";
import { and, eq } from "@kyren/db/drizzle";
import { chatMessages } from "@kyren/db/schema";
import { z } from "zod";

import { channelAccess, mentionedMemberIds } from "../../chat";
import { syncMentions } from "../../mentions";
import { runMessageAutomations } from "../../automations/engine";
import { isUniqueViolation } from "../../db-errors";
import { queueMentionEmails } from "../../chat-mention-mail";
import { postChatMessage } from "../../chat-post";
import { claimFiles, loadMessage } from "./helpers";
import { hydrateMessages } from "./hydrate";
import { chatProcedure, uuid } from "./types";

export const chatMessageSendProcedures = {
  send: chatProcedure("chat.post", { also: ["chat.files.upload"] })
    .input(
      z.object({
        channelId: uuid,
        body: z.string().max(10_000).default(""),
        parentId: uuid.optional(),
        clientId: z.string().max(64).optional(),
        fileIds: z.array(uuid).max(10).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const body = input.body.trim();

      if (!body && !input.fileIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Write something or attach a file.",
        });
      }

      const access = await channelAccess(ctx, input.channelId);

      if (!access.canPost) {
        throw new TRPCError({
          code: access.canRead ? "FORBIDDEN" : "NOT_FOUND",
          message: access.channel.archivedAt
            ? "This channel is archived."
            : access.canRead
              ? "You can't post here."
              : "Channel not found.",
        });
      }

      if (
        input.fileIds.length &&
        !(await ctx.permissions.can("chat.files.upload"))
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can't share files here.",
        });
      }

      if (input.clientId) {
        const [existing] = await ctx.db
          .select()
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.authorMemberId, access.memberId),
              eq(chatMessages.clientId, input.clientId),
            ),
          )
          .limit(1);

        if (existing) {
          return (await hydrateMessages(ctx, [existing], access.memberId))[0]!;
        }
      }

      if (input.parentId) {
        const parent = await loadMessage(ctx, input.parentId);

        if (parent.channelId !== input.channelId || parent.parentId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Reply in the thread of a message in this channel.",
          });
        }
      }

      const fileIds = await claimFiles(ctx, access.memberId, input.fileIds);
      const row = await ctx.db
        .transaction((tx) =>
          postChatMessage(tx, {
            organizationId: ctx.activeOrganization.id,
            channelId: input.channelId,
            memberId: access.memberId,
            body,
            parentId: input.parentId,
            clientId: input.clientId,
            fileIds,
            join: !access.membership,
          }),
        )
        .catch(async (error: unknown) => {
          if (input.clientId && isUniqueViolation(error)) {
            const [winner] = await ctx.db
              .select()
              .from(chatMessages)
              .where(
                and(
                  eq(chatMessages.authorMemberId, access.memberId),
                  eq(chatMessages.clientId, input.clientId),
                ),
              )
              .limit(1);

            if (winner) return { ...winner, duplicate: true as const };
          }

          throw error;
        });

      if ("duplicate" in row) {
        return (await hydrateMessages(ctx, [row], access.memberId))[0]!;
      }

      await runMessageAutomations({
        db: ctx.db,
        organizationId: ctx.activeOrganization.id,
        message: {
          id: row.id,
          channelId: row.channelId,
          parentId: row.parentId,
          body: row.body,
          authorMemberId: row.authorMemberId,
        },
      });

      return (
        await hydrateMessages(ctx, [row], access.memberId, {
          withReplies: !row.parentId,
        })
      )[0]!;
    }),

  edit: chatProcedure("chat.post")
    .input(
      z.object({ messageId: uuid, body: z.string().trim().min(1).max(10_000) }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await loadMessage(ctx, input.messageId);
      const access = await channelAccess(ctx, message.channelId);
      const memberId = access.memberId;

      if (message.authorMemberId !== memberId || message.deletedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own messages.",
        });
      }

      if (!access.canPost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can't edit messages in this conversation anymore.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(chatMessages)
          .set({ body: input.body, editedAt: new Date() })
          .where(eq(chatMessages.id, message.id));
        await queueMentionEmails(
          tx,
          { ...message, body: input.body },
          mentionedMemberIds(message.body),
        );
        await syncMentions(tx, {
          organizationId: ctx.activeOrganization.id,
          memberId,
          source: { type: "message", id: message.id },
          text: input.body,
          via: "chat",
          mode: "replace",
        });
      });

      return { ok: true };
    }),

  remove: chatProcedure("chat.post", { also: ["chat.channels.manage"] })
    .input(z.object({ messageId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const message = await loadMessage(ctx, input.messageId);
      const access = await channelAccess(ctx, message.channelId);

      if (message.authorMemberId !== access.memberId && !access.canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own messages.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(chatMessages)
          .set({ deletedAt: new Date(), pinnedAt: null })
          .where(eq(chatMessages.id, message.id));
        await syncMentions(tx, {
          organizationId: ctx.activeOrganization.id,
          memberId: access.memberId,
          source: { type: "message", id: message.id },
          text: "",
          via: "chat",
          mode: "replace",
        });
      });

      return { ok: true };
    }),
};
