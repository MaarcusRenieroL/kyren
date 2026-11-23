import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNull, or, sql } from "@zentro/db/drizzle";
import {
  chatChannels,
  chatFeedRules,
  chatMembers,
  chatMessages,
} from "@zentro/db/schema";
import { z } from "zod";
import { aiAvailable, askClaude } from "../../chat-ai";
import {
  currentMemberId,
  memberProfiles,
  plainBody,
  readableChannel,
} from "../../chat";
import { uuid, chatProcedure, manageableChannel } from "../chat-extras-shared";


export const chatFeedProcedures = {
  feedGet: chatProcedure("chat.view")
    .input(z.object({ channelId: uuid }))
    .query(async ({ ctx, input }) => {
      await readableChannel(ctx, input.channelId);

      const [rule] = await ctx.db
        .select()
        .from(chatFeedRules)
        .where(eq(chatFeedRules.channelId, input.channelId))
        .limit(1);

      return {
        enabled: rule?.enabled ?? false,
        events: rule?.events ?? [],
      };
    }),

  feedSet: chatProcedure("chat.post", { audit: ["chat.channel_updated"] })
    .input(
      z.object({
        channelId: uuid,
        enabled: z.boolean(),
        events: z
          .array(z.enum(["created", "done", "assigned", "overdue"]))
          .max(4),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await manageableChannel(ctx, input.channelId);

      if (access.channel.linkType !== "project") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Link the channel to a project to receive its activity.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(chatFeedRules)
          .values({
            channelId: input.channelId,
            enabled: input.enabled,
            events: input.events,
          })
          .onConflictDoUpdate({
            target: chatFeedRules.channelId,
            set: { enabled: input.enabled, events: input.events },
          });
        await ctx.audit.record(tx, {
          action: "chat.channel_updated",
          target: {
            id: input.channelId,
            label: `#${access.channel.name ?? "channel"}`,
          },
          metadata: { fields: ["activity feed"] },
        });
      });

      return { ok: true };
    }),

  // ── Catch up, summaries and translation ─────────────────────────────────

  /** What happened while the caller was away, per conversation. */
  catchUp: chatProcedure("chat.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const rows = await ctx.db
      .select({
        channelId: chatMembers.channelId,
        lastReadAt: chatMembers.lastReadAt,
        name: chatChannels.name,
        kind: chatChannels.kind,
      })
      .from(chatMembers)
      .innerJoin(chatChannels, eq(chatChannels.id, chatMembers.channelId))
      .where(
        and(
          eq(chatMembers.memberId, memberId),
          isNull(chatChannels.archivedAt),
          gt(chatChannels.lastMessageAt, chatMembers.lastReadAt),
        ),
      )
      .orderBy(desc(chatChannels.lastMessageAt))
      .limit(12);
    const result = [];

    for (const row of rows) {
      const unread = await ctx.db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.channelId, row.channelId),
            isNull(chatMessages.deletedAt),
            gt(chatMessages.createdAt, row.lastReadAt),
            sql`${chatMessages.authorMemberId} is distinct from ${memberId}`,
          ),
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(40);

      if (!unread.length) continue;

      const profiles = await memberProfiles(
        ctx,
        unread
          .map((message) => message.authorMemberId)
          .filter((id): id is string => Boolean(id)),
      );
      const names = new Map(
        [...profiles.values()].map((profile) => [
          profile.memberId,
          profile.name,
        ]),
      );
      const mentioned = unread.filter(
        (message) =>
          message.body.includes(`<@${memberId}>`) ||
          /<!(channel|here)>/.test(message.body),
      ).length;

      result.push({
        channelId: row.channelId,
        channelName: row.name,
        kind: row.kind as "channel" | "dm",
        count: unread.length,
        mentions: mentioned,
        people: [
          ...new Set(
            unread
              .map((message) =>
                message.authorMemberId
                  ? profiles.get(message.authorMemberId)?.name
                  : null,
              )
              .filter((name): name is string => Boolean(name)),
          ),
        ].slice(0, 4),
        latest: plainBody(unread[0]!.body, names).slice(0, 140),
        tasks: [
          ...new Set(
            unread.flatMap(
              (message) =>
                message.body.match(/\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/g) ?? [],
            ),
          ),
        ].slice(0, 5),
      });
    }

    return result;
  }),

};
