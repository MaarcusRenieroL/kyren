import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, sql } from "@zentro/db/drizzle";
import {
  chatEmojis,
  chatLinkPreviews,
  chatMessages,
  chatPolls,
  chatPollVotes,
  files,
} from "@zentro/db/schema";
import { z } from "zod";
import { postChatMessage } from "../../chat-post";
import { externalUrls, fetchPreview } from "../../chat-unfurl";
import { currentMemberId, readableChannel } from "../../chat";
import {
  uuid,
  chatProcedure,
  postableChannel,
  EMOJI_NAME,
  assertThreadParent,
} from "../chat-extras-shared";


export const chatPollsProcedures = {
  createPoll: chatProcedure("chat.post")
    .input(
      z.object({
        channelId: uuid,
        parentId: uuid.optional(),
        question: z.string().trim().min(1).max(200),
        options: z.array(z.string().trim().min(1).max(100)).min(2).max(8),
        multiple: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await postableChannel(ctx, input.channelId);

      await assertThreadParent(ctx, input.channelId, input.parentId);

      const message = await ctx.db.transaction(async (tx) => {
        const created = await postChatMessage(tx, {
          organizationId: ctx.activeOrganization.id,
          channelId: input.channelId,
          memberId: access.memberId,
          parentId: input.parentId,
          body: input.question,
          kind: "poll",
          join: !access.membership,
        });

        await tx.insert(chatPolls).values({
          messageId: created.id,
          question: input.question,
          options: input.options,
          multiple: input.multiple,
        });

        return created;
      });

      return { messageId: message.id };
    }),

  votePoll: chatProcedure("chat.post")
    .input(
      z.object({ pollId: uuid, optionIndex: z.number().int().min(0).max(7) }),
    )
    .mutation(async ({ ctx, input }) => {
      const [poll] = await ctx.db
        .select({ poll: chatPolls, channelId: chatMessages.channelId })
        .from(chatPolls)
        .innerJoin(chatMessages, eq(chatMessages.id, chatPolls.messageId))
        .where(eq(chatPolls.id, input.pollId))
        .limit(1);

      if (!poll || input.optionIndex >= poll.poll.options.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Poll not found." });
      }

      const access = await postableChannel(ctx, poll.channelId);

      if (poll.poll.closedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This poll is closed.",
        });
      }

      const mine = and(
        eq(chatPollVotes.pollId, input.pollId),
        eq(chatPollVotes.memberId, access.memberId),
      );

      // One vote change at a time per person and poll, so a double click or
      // two quick taps cannot leave two votes on a single-choice poll.
      await ctx.db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`poll:${input.pollId}:${access.memberId}`}, 0))`,
        );

        const removed = await tx
          .delete(chatPollVotes)
          .where(and(mine, eq(chatPollVotes.optionIndex, input.optionIndex)))
          .returning({ id: chatPollVotes.id });

        if (!removed.length) {
          // One choice per person unless the poll allows several.
          if (!poll.poll.multiple) await tx.delete(chatPollVotes).where(mine);

          await tx.insert(chatPollVotes).values({
            pollId: input.pollId,
            memberId: access.memberId,
            optionIndex: input.optionIndex,
          });
        }
      });

      return { ok: true };
    }),

  closePoll: chatProcedure("chat.post")
    .input(z.object({ pollId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const [poll] = await ctx.db
        .select({
          authorMemberId: chatMessages.authorMemberId,
          channelId: chatMessages.channelId,
        })
        .from(chatPolls)
        .innerJoin(chatMessages, eq(chatMessages.id, chatPolls.messageId))
        .where(eq(chatPolls.id, input.pollId))
        .limit(1);

      if (!poll) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Poll not found." });
      }

      const access = await postableChannel(ctx, poll.channelId);

      if (poll.authorMemberId !== access.memberId && !access.canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the author can close a poll.",
        });
      }

      await ctx.db
        .update(chatPolls)
        .set({ closedAt: new Date() })
        .where(eq(chatPolls.id, input.pollId));

      return { ok: true };
    }),

  // ── Link previews ───────────────────────────────────────────────────────

  /** Fetches previews for external links that have none yet. */
  unfurl: chatProcedure("chat.view")
    .input(z.object({ messageId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const [message] = await ctx.db
        .select({ body: chatMessages.body, channelId: chatMessages.channelId })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.id, input.messageId),
            eq(chatMessages.organizationId, ctx.activeOrganization.id),
          ),
        )
        .limit(1);

      if (!message) return { fetched: 0 };

      await readableChannel(ctx, message.channelId);

      const urls = externalUrls(message.body);

      if (!urls.length) return { fetched: 0 };

      const known = await ctx.db
        .select({ url: chatLinkPreviews.url })
        .from(chatLinkPreviews)
        .where(
          and(
            eq(chatLinkPreviews.organizationId, ctx.activeOrganization.id),
            inArray(chatLinkPreviews.url, urls),
          ),
        );
      const have = new Set(known.map((row) => row.url));
      const todo = urls.filter((url) => !have.has(url));

      for (const url of todo) {
        const preview = await fetchPreview(url);

        await ctx.db
          .insert(chatLinkPreviews)
          .values({
            organizationId: ctx.activeOrganization.id,
            url,
            title: preview?.title ?? null,
            description: preview?.description ?? null,
            image: preview?.image ?? null,
            siteName: preview?.siteName ?? null,
            failed: !preview || !preview.title,
          })
          .onConflictDoNothing();
      }

      return { fetched: todo.length };
    }),

  // ── Custom emoji ────────────────────────────────────────────────────────

};
