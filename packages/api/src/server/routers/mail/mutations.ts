import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "@kyren/db/drizzle";
import {
  files,
  mailAttachments,
  mailMessages,
  mailRecipients,
  members,
  users,
} from "@kyren/db/schema";
import { z } from "zod";
import { currentMemberId } from "../../chat";
import { likePattern } from "../../like";
import { uuid } from "../../zod-common";
import {
  procedure,
  draftInput,
  writeMessage,
} from "./helpers";

export const mailMutationsProcedures = {
  saveDraft: procedure("mail.send")
    .input(draftInput)
    .mutation(({ ctx, input }) => writeMessage(ctx, input, false)),

  send: procedure("mail.send")
    .input(draftInput)
    .mutation(({ ctx, input }) => writeMessage(ctx, input, true)),

  /** Marks messages read or unread, starred, or trashed and restored. */
  update: procedure("mail.view")
    .input(
      z.object({
        ids: z.array(uuid).min(1).max(100),
        read: z.boolean().optional(),
        starred: z.boolean().optional(),
        trashed: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const now = new Date();

      await ctx.db
        .update(mailRecipients)
        .set({
          ...(input.read === undefined
            ? {}
            : { readAt: input.read ? now : null }),
          ...(input.starred === undefined ? {} : { starred: input.starred }),
          ...(input.trashed === undefined
            ? {}
            : { trashedAt: input.trashed ? now : null }),
        })
        .where(
          and(
            eq(mailRecipients.memberId, memberId),
            inArray(mailRecipients.messageId, input.ids),
          ),
        );

      if (input.starred !== undefined || input.trashed !== undefined) {
        await ctx.db
          .update(mailMessages)
          .set({
            ...(input.starred === undefined
              ? {}
              : { senderStarred: input.starred }),
            ...(input.trashed === undefined
              ? {}
              : { senderTrashedAt: input.trashed ? now : null }),
          })
          .where(
            and(
              eq(mailMessages.senderMemberId, memberId),
              eq(mailMessages.organizationId, ctx.activeOrganization.id),
              inArray(mailMessages.id, input.ids),
            ),
          );
      }

      return { ok: true };
    }),

  /** Removes trashed messages for good (drafts are deleted outright). */
  purge: procedure("mail.view")
    .input(z.object({ ids: z.array(uuid).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const now = new Date();

      await ctx.db
        .delete(mailMessages)
        .where(
          and(
            eq(mailMessages.senderMemberId, memberId),
            eq(mailMessages.organizationId, ctx.activeOrganization.id),
            isNull(mailMessages.sentAt),
            inArray(mailMessages.id, input.ids),
          ),
        );
      await ctx.db
        .update(mailRecipients)
        .set({ purgedAt: now })
        .where(
          and(
            eq(mailRecipients.memberId, memberId),
            isNotNull(mailRecipients.trashedAt),
            inArray(mailRecipients.messageId, input.ids),
          ),
        );
      await ctx.db
        .update(mailMessages)
        .set({ senderPurgedAt: now })
        .where(
          and(
            eq(mailMessages.senderMemberId, memberId),
            eq(mailMessages.organizationId, ctx.activeOrganization.id),
            isNotNull(mailMessages.senderTrashedAt),
            inArray(mailMessages.id, input.ids),
          ),
        );

      return { ok: true };
    }),
};
