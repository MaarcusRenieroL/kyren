import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from "@kyren/db/drizzle";
import {
  chatChannels,
  chatDrafts,
  chatMembers,
  chatMessages,
  chatSaved,
  chatScheduled,
  chatThreadFollows,
} from "@kyren/db/schema";

import { currentMemberId, memberProfiles } from "../../chat";
import { runChatJobsLazily } from "../../chat-jobs";
import { chatProcedure, dmTitle, linkLabels } from "./helpers";

export const chatSidebarProcedures = {
  /**
   * The caller's conversations for the chat sidebar, with unread counts.
   * A muted conversation still counts, but never shows as a mention badge.
   */
  sidebar: chatProcedure("chat.view").query(async ({ ctx }) => {
    // Scheduled messages and reminders are delivered from here at most once
    // a minute, so they work without a cron job; the daily cron adds the rest.
    await runChatJobsLazily(ctx.db, ctx.activeOrganization.id);

    const memberId = await currentMemberId(ctx);
    const [reminders, drafts, scheduled, followed] = await Promise.all([
      ctx.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(chatSaved)
        .where(
          and(
            eq(chatSaved.memberId, memberId),
            isNull(chatSaved.completedAt),
            sql`${chatSaved.remindAt} <= now()`,
          ),
        ),
      ctx.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(chatDrafts)
        .where(eq(chatDrafts.memberId, memberId)),
      ctx.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(chatScheduled)
        .where(
          and(
            eq(chatScheduled.memberId, memberId),
            isNull(chatScheduled.sentAt),
            isNull(chatScheduled.canceledAt),
          ),
        ),
      ctx.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(chatThreadFollows)
        .innerJoin(
          chatMessages,
          eq(chatMessages.parentId, chatThreadFollows.parentId),
        )
        .where(
          and(
            eq(chatThreadFollows.memberId, memberId),
            eq(chatThreadFollows.following, true),
            isNull(chatMessages.deletedAt),
            sql`${chatMessages.createdAt} > ${chatThreadFollows.lastReadAt}`,
            sql`${chatMessages.authorMemberId} is distinct from ${memberId}`,
          ),
        ),
    ]);
    const extras = {
      dueReminders: reminders[0]?.count ?? 0,
      drafts: drafts[0]?.count ?? 0,
      scheduled: scheduled[0]?.count ?? 0,
      threadsUnread: followed[0]?.count ?? 0,
    };
    const dnd = Boolean(
      (await memberProfiles(ctx, [memberId])).get(memberId)?.dnd,
    );
    const mine = await ctx.db
      .select({ channel: chatChannels, membership: chatMembers })
      .from(chatMembers)
      .innerJoin(chatChannels, eq(chatChannels.id, chatMembers.channelId))
      .where(
        and(
          eq(chatMembers.memberId, memberId),
          eq(chatChannels.organizationId, ctx.activeOrganization.id),
        ),
      )
      .orderBy(asc(chatChannels.name));

    if (!mine.length) return { channels: [], totalUnread: 0, extras };

    const channelIds = mine.map((row) => row.channel.id);
    const counts = await ctx.db
      .select({
        channelId: chatMessages.channelId,
        unread:
          sql<number>`count(*) filter (where ${chatMessages.parentId} is null)`.mapWith(
            Number,
          ),
        mentions:
          sql<number>`count(*) filter (where ${chatMessages.body} like ${`%<@${memberId}>%`} or (${chatMessages.parentId} is null and ${chatMessages.body} ~ '<!(channel|here)>'))`.mapWith(
            Number,
          ),
      })
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
          inArray(chatMessages.channelId, channelIds),
          isNull(chatMessages.deletedAt),
          sql`${chatMessages.createdAt} > ${chatMembers.lastReadAt}`,
          sql`${chatMessages.authorMemberId} is distinct from ${memberId}`,
        ),
      )
      .groupBy(chatMessages.channelId);

    const dmIds = mine
      .filter((row) => row.channel.kind === "dm")
      .map((row) => row.channel.id);
    const dmRows = dmIds.length
      ? await ctx.db
          .select({
            channelId: chatMembers.channelId,
            memberId: chatMembers.memberId,
          })
          .from(chatMembers)
          .where(
            and(
              inArray(chatMembers.channelId, dmIds),
              ne(chatMembers.memberId, memberId),
            ),
          )
      : [];
    const profiles = await memberProfiles(
      ctx,
      dmRows.map((row) => row.memberId),
    );
    const labelOf = await linkLabels(
      ctx,
      mine.map((row) => row.channel),
    );
    let totalUnread = 0;

    const channels = mine.map(({ channel, membership }) => {
      const count = counts.find((row) => row.channelId === channel.id);
      const muted =
        membership.notify === "mute" ||
        Boolean(membership.mutedUntil && membership.mutedUntil > new Date());
      const others = dmRows
        .filter((row) => row.channelId === channel.id)
        .map((row) => profiles.get(row.memberId))
        .filter((profile) => profile !== undefined);
      const unread = count?.unread ?? 0;
      const mentions = muted ? 0 : (count?.mentions ?? 0);

      if (!muted && !channel.archivedAt) {
        totalUnread += channel.kind === "dm" ? unread : mentions || 0;
      }

      return {
        id: channel.id,
        kind: channel.kind as "channel" | "dm",
        name: channel.name,
        title:
          channel.kind === "dm"
            ? dmTitle(others.map((other) => other.name))
            : (channel.name ?? ""),
        topic: channel.topic,
        visibility: channel.visibility as "public" | "private",
        link: labelOf(channel.linkType, channel.linkId),
        archived: Boolean(channel.archivedAt),
        pinned: membership.pinned,
        notify: membership.notify as "all" | "mentions" | "mute",
        muted,
        unread,
        mentions: channel.kind === "dm" && !muted ? unread : mentions,
        lastMessageAt: channel.lastMessageAt,
        people: others,
      };
    });

    return { channels, totalUnread: dnd ? 0 : totalUnread, extras, dnd };
  }),

  /** Public channels the caller is not in, to browse and join. */
  browse: chatProcedure("chat.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const rows = await ctx.db
      .select({
        id: chatChannels.id,
        name: chatChannels.name,
        topic: chatChannels.topic,
        linkType: chatChannels.linkType,
        linkId: chatChannels.linkId,
        members:
          sql<number>`(select count(*) from ${chatMembers} m where m."channelId" = ${chatChannels.id})`.mapWith(
            Number,
          ),
      })
      .from(chatChannels)
      .leftJoin(
        chatMembers,
        and(
          eq(chatMembers.channelId, chatChannels.id),
          eq(chatMembers.memberId, memberId),
        ),
      )
      .where(
        and(
          eq(chatChannels.organizationId, ctx.activeOrganization.id),
          eq(chatChannels.kind, "channel"),
          eq(chatChannels.visibility, "public"),
          isNull(chatChannels.archivedAt),
          isNull(chatMembers.id),
        ),
      )
      .orderBy(asc(chatChannels.name));
    const labelOf = await linkLabels(ctx, rows);

    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      topic: row.topic,
      members: row.members,
      link: labelOf(row.linkType, row.linkId),
    }));
  }),
};
