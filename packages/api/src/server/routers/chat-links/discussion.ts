import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "@kyren/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatMembers,
  chatMessages,
  docs,
  files,
  projects,
  tasks,
} from "@kyren/db/schema";
import { z } from "zod";
import { visibleDocsCondition } from "../../access";
import {
  currentMemberId,
  memberProfiles,
  normalizeChannelName,
  plainBody,
  readableChannelIds,
} from "../../chat";
import {
  chatProcedure,
  viewableItem,
  itemIdFromRef,
  discussionChannel,
  uuid,
  itemType,
  type Item,
} from "./helpers";
import { likePattern } from "../../like";

export const chatLinksDiscussionProcedures = {
  discuss: chatProcedure("chat.post", {
    audit: ["chat.channel_created", "chat.member_added"],
  })
    .input(
      z
        .object({
          type: itemType,
          id: uuid.optional(),
          /** A task key or a doc or project slug, from an address. */
          ref: z.string().trim().min(1).max(120).optional(),
        })
        .refine((value) => value.id || value.ref, "Say which item."),
    )
    .mutation(async ({ ctx, input }) => {
      const id = input.id ?? (await itemIdFromRef(ctx, input.type, input.ref!));
      const item = await viewableItem(ctx, input.type, id);
      const memberId = await currentMemberId(ctx);
      let channel = await discussionChannel(ctx, item, memberId);
      let created = false;

      if (!channel) {
        const base = normalizeChannelName(item.slug) || "discussion";
        let name = base;

        for (let attempt = 2; attempt < 6; attempt += 1) {
          const [taken] = await ctx.db
            .select({ id: chatChannels.id })
            .from(chatChannels)
            .where(
              and(
                eq(chatChannels.organizationId, ctx.activeOrganization.id),
                eq(chatChannels.name, name),
              ),
            )
            .limit(1);

          if (!taken) break;

          name = `${base.slice(0, 76)}-${attempt}`;
        }

        const [row] = await ctx.db
          .insert(chatChannels)
          .values({
            organizationId: ctx.activeOrganization.id,
            kind: "channel",
            name,
            topic: item.title.slice(0, 250),
            visibility: "private",
            linkType: item.type,
            linkId: item.id,
            discussion: true,
            createdByMemberId: memberId,
          })
          .onConflictDoNothing()
          .returning();

        channel = row ?? (await discussionChannel(ctx, item, memberId));
        created = Boolean(row);

        if (row) {
          await ctx.audit.record(ctx.db, {
            action: "chat.channel_created",
            target: { id: row.id, label: `#${row.name}` },
            metadata: { visibility: "private", link: item.type },
          });
        }
      }

      if (!created) ctx.audit.skipped("chat.channel_created");

      if (!channel) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not open the discussion.",
        });
      }

      const joined = await ctx.db
        .insert(chatMembers)
        .values({
          channelId: channel.id,
          memberId,
          role: created ? "admin" : "member",
        })
        .onConflictDoNothing()
        .returning({ id: chatMembers.id });

      if (joined.length && !created) {
        await ctx.audit.record(ctx.db, {
          action: "chat.member_added",
          target: { id: channel.id, label: `#${channel.name}` },
          metadata: { count: 1 },
        });
      } else {
        ctx.audit.skipped("chat.member_added");
      }

      return {
        channelId: channel.id,
        name: channel.name ?? "",
        created,
      };
    }),

  /** What the discussion panel on an item shows, without creating anything. */
  discussion: chatProcedure("chat.view")
    .input(z.object({ type: itemType, id: uuid }))
    .query(async ({ ctx, input }) => {
      const item = await viewableItem(ctx, input.type, input.id);
      const memberId = await currentMemberId(ctx);
      const channel = await discussionChannel(ctx, item, memberId);

      if (!channel) {
        return { exists: false as const, title: item.title };
      }

      const [counts] = await ctx.db
        .select({
          messages: sql<number>`count(*)`.mapWith(Number),
          lastAt: sql<Date | null>`max(${chatMessages.createdAt})`.mapWith(
            chatMessages.createdAt,
          ),
        })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.channelId, channel.id),
            isNull(chatMessages.deletedAt),
          ),
        );
      const [mine] = await ctx.db
        .select({ lastReadAt: chatMembers.lastReadAt })
        .from(chatMembers)
        .where(
          and(
            eq(chatMembers.channelId, channel.id),
            eq(chatMembers.memberId, memberId),
          ),
        )
        .limit(1);
      const [unread] = mine
        ? await ctx.db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(chatMessages)
            .where(
              and(
                eq(chatMessages.channelId, channel.id),
                isNull(chatMessages.deletedAt),
                sql`${chatMessages.createdAt} > ${mine.lastReadAt}`,
                sql`${chatMessages.authorMemberId} is distinct from ${memberId}`,
              ),
            )
        : [{ count: 0 }];
      const people = await ctx.db
        .select({ memberId: chatMembers.memberId })
        .from(chatMembers)
        .where(eq(chatMembers.channelId, channel.id))
        .limit(6);
      const profiles = await memberProfiles(
        ctx,
        people.map((row) => row.memberId),
      );
      const shared = await ctx.db
        .select({
          id: files.id,
          name: files.name,
          mimeType: files.mimeType,
          size: files.size,
        })
        .from(chatAttachments)
        .innerJoin(chatMessages, eq(chatMessages.id, chatAttachments.messageId))
        .innerJoin(files, eq(files.id, chatAttachments.fileId))
        .where(
          and(
            eq(chatMessages.channelId, channel.id),
            isNull(chatMessages.deletedAt),
            isNull(files.deletedAt),
          ),
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(6);

      return {
        exists: true as const,
        title: item.title,
        channelId: channel.id,
        name: channel.name ?? "",
        joined: Boolean(mine),
        messages: counts?.messages ?? 0,
        lastAt: counts?.lastAt ?? null,
        unread: unread?.count ?? 0,
        people: people
          .map((row) => profiles.get(row.memberId)?.name)
          .filter((name): name is string => Boolean(name)),
        files: shared.map((file) => ({
          ...file,
          url: `/api/files/${file.id}`,
        })),
      };
    }),

  /** Where a file has been shared in chat, for the file's own page. */
};
