import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "@zentro/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatMembers,
  chatMessages,
} from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId, readableChannelIds } from "../../chat";
import { hydrateMessages } from "./hydrate";
import { chatProcedure, uuid } from "./types";

export const chatMessageSearchProcedures = {
  /**
   * Messages matching words, across every conversation the caller may read,
   * narrowed by who wrote them, where, what they carry and when.
   */
  search: chatProcedure("chat.view")
    .input(
      z.object({
        q: z.string().trim().max(200),
        fromMemberId: uuid.optional(),
        channelId: uuid.optional(),
        has: z.enum(["file", "link", "task"]).optional(),
        after: z.coerce.date().optional(),
        before: z.coerce.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const readable = await readableChannelIds(ctx, memberId);
      const channelIds = input.channelId
        ? readable.filter((id) => id === input.channelId)
        : readable;

      if (
        !channelIds.length ||
        (!input.q && !input.fromMemberId && !input.has)
      ) {
        return { results: [], total: 0 };
      }

      const words = input.q.split(/\s+/).filter(Boolean).slice(0, 8);
      const filters: Array<SQL | undefined> = [
        inArray(chatMessages.channelId, channelIds),
        isNull(chatMessages.deletedAt),
        ...words.map((word) =>
          ilike(chatMessages.body, `%${word.replace(/[%_\\]/g, "\\$&")}%`),
        ),
        input.fromMemberId
          ? eq(chatMessages.authorMemberId, input.fromMemberId)
          : undefined,
        input.after ? gte(chatMessages.createdAt, input.after) : undefined,
        input.before ? lte(chatMessages.createdAt, input.before) : undefined,
        input.has === "file"
          ? sql`exists (select 1 from ${chatAttachments} a where a."messageId" = ${chatMessages.id})`
          : input.has === "link"
            ? sql`${chatMessages.body} ~* 'https?://'`
            : input.has === "task"
              ? sql`${chatMessages.body} ~ '\\m[A-Z][A-Z0-9]{1,9}-[0-9]+\\M'`
              : undefined,
      ];
      const rows = await ctx.db
        .select()
        .from(chatMessages)
        .where(and(...filters))
        .orderBy(desc(chatMessages.createdAt))
        .limit(100);
      const channelRows = rows.length
        ? await ctx.db
            .select({
              id: chatChannels.id,
              name: chatChannels.name,
              kind: chatChannels.kind,
            })
            .from(chatChannels)
            .where(
              inArray(
                chatChannels.id,
                rows.map((row) => row.channelId),
              ),
            )
        : [];
      const views = await hydrateMessages(ctx, rows, memberId);

      return {
        total: rows.length,
        results: views.map((view) => {
          const channel = channelRows.find(
            (entry) => entry.id === view.channelId,
          );

          return {
            ...view,
            channel: {
              id: view.channelId,
              name: channel?.name ?? null,
              kind: (channel?.kind ?? "channel") as "channel" | "dm",
            },
          };
        }),
      };
    }),

  /** Messages that mention the caller, newest first, with unread marks. */
  mentions: chatProcedure("chat.view")
    .input(
      z
        .object({ unreadOnly: z.boolean().default(false) })
        .default({ unreadOnly: false }),
    )
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const rows = await ctx.db
        .select({ message: chatMessages, lastReadAt: chatMembers.lastReadAt })
        .from(chatMessages)
        .innerJoin(
          chatMembers,
          and(
            eq(chatMembers.channelId, chatMessages.channelId),
            eq(chatMembers.memberId, memberId),
          ),
        )
        .where(
          and(
            eq(chatMessages.organizationId, ctx.activeOrganization.id),
            isNull(chatMessages.deletedAt),
            sql`${chatMessages.authorMemberId} is distinct from ${memberId}`,
            or(
              sql`${chatMessages.body} like ${`%<@${memberId}>%`}`,
              sql`${chatMessages.body} ~ '<!(channel|here)>'`,
            ),
            input.unreadOnly
              ? sql`${chatMessages.createdAt} > ${chatMembers.lastReadAt}`
              : undefined,
          ),
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(100);
      const views = await hydrateMessages(
        ctx,
        rows.map((row) => row.message),
        memberId,
      );
      const channelRows = rows.length
        ? await ctx.db
            .select({ id: chatChannels.id, name: chatChannels.name })
            .from(chatChannels)
            .where(
              inArray(
                chatChannels.id,
                rows.map((row) => row.message.channelId),
              ),
            )
        : [];

      return views.map((view, index) => ({
        ...view,
        unread: rows[index]!.message.createdAt > rows[index]!.lastReadAt,
        channelName:
          channelRows.find((entry) => entry.id === view.channelId)?.name ??
          null,
      }));
    }),

  /** Marks every conversation with an unread mention as read. */
  markMentionsRead: chatProcedure("chat.view").mutation(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);

    await ctx.db
      .update(chatMembers)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(chatMembers.memberId, memberId),
          sql`exists (select 1 from ${chatMessages} m where m."channelId" = ${chatMembers.channelId} and m."deletedAt" is null and m."createdAt" > ${chatMembers.lastReadAt} and (m.body like ${`%<@${memberId}>%`} or m.body ~ '<!(channel|here)>'))`,
        ),
      );

    return { ok: true };
  }),
};
