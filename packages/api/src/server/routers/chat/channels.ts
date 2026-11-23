import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, sql } from "@zentro/db/drizzle";
import { chatChannels, chatMembers, chatMessages } from "@zentro/db/schema";
import { z } from "zod";

import {
  channelAccess,
  memberProfiles,
  normalizeChannelName,
} from "../../chat";
import { chatProcedure, dmTitle, linkLabels, uuid } from "./helpers";

export const chatChannelCoreProcedures = {
  /**
   * One conversation by name (channels) or id (DMs). A private channel the
   * caller is not in answers with who can add them, so they can ask.
   */
  get: chatProcedure("chat.view")
    .input(
      z.object({ name: z.string().max(80).optional(), id: uuid.optional() }),
    )
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ id: chatChannels.id })
        .from(chatChannels)
        .where(
          and(
            eq(chatChannels.organizationId, ctx.activeOrganization.id),
            input.id
              ? eq(chatChannels.id, input.id)
              : eq(chatChannels.name, normalizeChannelName(input.name ?? "")),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Channel not found.",
        });
      }

      const access = await channelAccess(ctx, row.id);
      const { channel } = access;
      const memberRows = await ctx.db
        .select({
          memberId: chatMembers.memberId,
          role: chatMembers.role,
        })
        .from(chatMembers)
        .where(eq(chatMembers.channelId, channel.id))
        .orderBy(asc(chatMembers.joinedAt));
      const profiles = await memberProfiles(
        ctx,
        memberRows.map((entry) => entry.memberId),
      );
      const people = memberRows
        .map((entry) => ({
          ...profiles.get(entry.memberId)!,
          role: entry.role,
        }))
        .filter((entry) => entry.memberId);

      if (!access.canRead) {
        // A private channel's name is known to whoever has its link; who
        // can let them in is all they learn.
        if (channel.kind !== "channel") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Channel not found.",
          });
        }

        return {
          access: "none" as const,
          id: channel.id,
          name: channel.name ?? "",
          visibility: channel.visibility,
          admins: people
            .filter((entry) => entry.role === "admin")
            .map(({ memberId, name }) => ({ memberId, name })),
        };
      }

      const labelOf = await linkLabels(ctx, [channel]);
      const pins = await ctx.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.channelId, channel.id),
            isNull(chatMessages.deletedAt),
            sql`${chatMessages.pinnedAt} is not null`,
          ),
        );
      const others = people.filter(
        (entry) => entry.memberId !== access.memberId,
      );

      return {
        access: "full" as const,
        id: channel.id,
        kind: channel.kind as "channel" | "dm",
        name: channel.name ?? "",
        title:
          channel.kind === "dm"
            ? dmTitle(others.map((entry) => entry.name))
            : (channel.name ?? ""),
        topic: channel.topic,
        description: channel.description,
        canvas: channel.canvas,
        retentionDays: channel.retentionDays,
        visibility: channel.visibility as "public" | "private",
        link: labelOf(channel.linkType, channel.linkId),
        archivedAt: channel.archivedAt,
        createdAt: channel.createdAt,
        createdByMemberId: channel.createdByMemberId,
        people,
        pinCount: pins[0]?.count ?? 0,
        joined: Boolean(access.membership),
        role: access.membership?.role ?? null,
        notify: access.membership?.notify ?? "all",
        notifyReplies: access.membership?.notifyReplies ?? true,
        mutedUntil: access.membership?.mutedUntil ?? null,
        pinned: access.membership?.pinned ?? false,
        lastReadAt: access.membership?.lastReadAt ?? null,
        canPost: access.canPost,
        canManage: access.canManage,
      };
    }),

  archive: chatProcedure("chat.view", {
    audit: ["chat.channel_archived", "chat.channel_unarchived"],
    also: ["chat.channels.manage"],
  })
    .input(z.object({ channelId: uuid, archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const access = await channelAccess(ctx, input.channelId);

      if (!access.canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel admins can archive this channel.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(chatChannels)
          .set({ archivedAt: input.archived ? new Date() : null })
          .where(eq(chatChannels.id, input.channelId));
        await ctx.audit.record(tx, {
          action: input.archived
            ? "chat.channel_archived"
            : "chat.channel_unarchived",
          target: { id: input.channelId, label: `#${access.channel.name}` },
        });
      });
      return { ok: true };
    }),
};
