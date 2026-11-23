import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull, sql } from "@kyren/db/drizzle";
import {
  chatChannels,
  chatMembers,
  chatMessages,
  members,
} from "@kyren/db/schema";
import { z } from "zod";

import {
  channelAccess,
  currentMemberId,
  memberProfiles,
} from "../../chat";
import { chatProcedure, uuid } from "./helpers";

export const chatDmProcedures = {
  /** A direct message with these people, reusing one that already exists. */
  openDm: chatProcedure("chat.post")
    .input(z.object({ memberIds: z.array(uuid).min(1).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const profiles = await memberProfiles(ctx, input.memberIds);
      const everyone = [...new Set([memberId, ...[...profiles.keys()]])].sort();

      if (everyone.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick someone to message.",
        });
      }

      const candidates = await ctx.db
        .select({
          id: chatChannels.id,
          people: sql<
            string[]
          >`array_agg(${chatMembers.memberId}::text order by ${chatMembers.memberId})`,
        })
        .from(chatChannels)
        .innerJoin(chatMembers, eq(chatMembers.channelId, chatChannels.id))
        .where(
          and(
            eq(chatChannels.organizationId, ctx.activeOrganization.id),
            eq(chatChannels.kind, "dm"),
          ),
        )
        .groupBy(chatChannels.id);
      const existing = candidates.find(
        (row) => row.people.join(",") === everyone.join(","),
      );

      if (existing) return { id: existing.id };

      const channel = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(chatChannels)
          .values({
            organizationId: ctx.activeOrganization.id,
            kind: "dm",
            visibility: "private",
            createdByMemberId: memberId,
          })
          .returning({ id: chatChannels.id });

        await tx
          .insert(chatMembers)
          .values(everyone.map((id) => ({ channelId: row!.id, memberId: id })));

        return row!;
      });

      return { id: channel.id };
    }),

  /**
   * Asks a private channel's admin to add the caller, as a direct message
   * from the caller with a link back to the channel.
   */
  requestAccess: chatProcedure("chat.post")
    .input(z.object({ channelId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const access = await channelAccess(ctx, input.channelId);

      if (access.canRead || access.channel.kind !== "channel") {
        return { ok: true, adminName: null };
      }

      const [admin] = await ctx.db
        .select({ memberId: chatMembers.memberId })
        .from(chatMembers)
        .where(
          and(
            eq(chatMembers.channelId, input.channelId),
            eq(chatMembers.role, "admin"),
          ),
        )
        .orderBy(asc(chatMembers.joinedAt))
        .limit(1);

      if (!admin) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nobody can add you to this channel right now.",
        });
      }

      const everyone = [access.memberId, admin.memberId].sort();
      const candidates = await ctx.db
        .select({
          id: chatChannels.id,
          people: sql<
            string[]
          >`array_agg(${chatMembers.memberId}::text order by ${chatMembers.memberId})`,
        })
        .from(chatChannels)
        .innerJoin(chatMembers, eq(chatMembers.channelId, chatChannels.id))
        .where(
          and(
            eq(chatChannels.organizationId, ctx.activeOrganization.id),
            eq(chatChannels.kind, "dm"),
          ),
        )
        .groupBy(chatChannels.id);
      let dmId = candidates.find(
        (row) => row.people.join(",") === everyone.join(","),
      )?.id;

      await ctx.db.transaction(async (tx) => {
        if (!dmId) {
          const [row] = await tx
            .insert(chatChannels)
            .values({
              organizationId: ctx.activeOrganization.id,
              kind: "dm",
              visibility: "private",
              createdByMemberId: access.memberId,
            })
            .returning({ id: chatChannels.id });

          dmId = row!.id;
          await tx
            .insert(chatMembers)
            .values(everyone.map((id) => ({ channelId: dmId!, memberId: id })));
        }

        const now = new Date();

        await tx.insert(chatMessages).values({
          organizationId: ctx.activeOrganization.id,
          channelId: dmId!,
          authorMemberId: access.memberId,
          body: `Could you add me to #${access.channel.name}? /chat/${access.channel.name}`,
          createdAt: now,
        });
        await tx
          .update(chatChannels)
          .set({ lastMessageAt: now })
          .where(eq(chatChannels.id, dmId!));
      });

      const profiles = await memberProfiles(ctx, [admin.memberId]);

      return {
        ok: true,
        adminName: profiles.get(admin.memberId)?.name ?? null,
      };
    }),

  /** People in the organization, to start DMs and add to channels. */
  people: chatProcedure("chat.view").query(async ({ ctx }) => {
    const memberId = await currentMemberId(ctx);
    const rows = await ctx.db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.organizationId, ctx.activeOrganization.id));
    const profiles = await memberProfiles(
      ctx,
      rows.map((row) => row.id),
    );

    return [...profiles.values()]
      .map((profile) => ({ ...profile, isMe: profile.memberId === memberId }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }),

  /** Channels linked to a project or team, for their pages. */
  linkedTo: chatProcedure("chat.view")
    .input(z.object({ type: z.enum(["team", "project"]), id: uuid }))
    .query(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const rows = await ctx.db
        .select({
          id: chatChannels.id,
          name: chatChannels.name,
          visibility: chatChannels.visibility,
          lastMessageAt: chatChannels.lastMessageAt,
          joined: sql<boolean>`${chatMembers.id} is not null`,
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
            eq(chatChannels.linkType, input.type),
            eq(chatChannels.linkId, input.id),
            isNull(chatChannels.archivedAt),
          ),
        )
        .orderBy(desc(chatChannels.lastMessageAt));

      return rows.filter((row) => row.visibility === "public" || row.joined);
    }),
};
