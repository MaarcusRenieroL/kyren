import { TRPCError } from "@trpc/server";
import { and, eq } from "@zentro/db/drizzle";
import { chatMembers } from "@zentro/db/schema";
import { z } from "zod";

import {
  channelAccess,
  currentMemberId,
  readableChannel,
} from "../../chat";
import { addMembersHelper, chatProcedure, uuid } from "./helpers";

export const chatMemberProcedures = {
  addMembers: chatProcedure("chat.view", {
    audit: ["chat.member_added"],
    also: ["chat.channels.manage"],
  })
    .input(
      z.object({ channelId: uuid, memberIds: z.array(uuid).min(1).max(200) }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await channelAccess(ctx, input.channelId);
      const allowed =
        access.canManage ||
        (access.membership && access.channel.visibility === "public");

      if (!allowed || access.channel.kind !== "channel") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel admins can add people here.",
        });
      }

      const added = await addMembersHelper(
        ctx,
        input.channelId,
        input.memberIds,
      );

      if (added.length) {
        await ctx.audit.record(ctx.db, {
          action: "chat.member_added",
          target: { id: input.channelId, label: `#${access.channel.name}` },
          metadata: { count: added.length },
        });
      } else {
        ctx.audit.skipped("chat.member_added");
      }

      return { added: added.length };
    }),

  removeMember: chatProcedure("chat.view", {
    audit: ["chat.member_removed"],
    also: ["chat.channels.manage"],
  })
    .input(z.object({ channelId: uuid, memberId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const access = await channelAccess(ctx, input.channelId);
      const self = input.memberId === access.memberId;

      if (access.channel.kind !== "channel" || (!self && !access.canManage)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel admins can remove people.",
        });
      }

      const admins = await ctx.db
        .select({ memberId: chatMembers.memberId })
        .from(chatMembers)
        .where(
          and(
            eq(chatMembers.channelId, input.channelId),
            eq(chatMembers.role, "admin"),
          ),
        );

      if (
        admins.length === 1 &&
        admins[0]!.memberId === input.memberId &&
        access.channel.visibility === "private"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Make someone else a channel admin first.",
        });
      }

      await ctx.db
        .delete(chatMembers)
        .where(
          and(
            eq(chatMembers.channelId, input.channelId),
            eq(chatMembers.memberId, input.memberId),
          ),
        );
      await ctx.audit.record(ctx.db, {
        action: "chat.member_removed",
        target: { id: input.channelId, label: `#${access.channel.name}` },
        metadata: { left: self },
      });

      return { ok: true };
    }),

  setRole: chatProcedure("chat.view", {
    audit: ["chat.member_role_changed"],
    also: ["chat.channels.manage"],
  })
    .input(
      z.object({
        channelId: uuid,
        memberId: uuid,
        role: z.enum(["admin", "member"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await channelAccess(ctx, input.channelId);

      if (!access.canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel admins can change roles.",
        });
      }

      if (input.role === "member") {
        const admins = await ctx.db
          .select({ memberId: chatMembers.memberId })
          .from(chatMembers)
          .where(
            and(
              eq(chatMembers.channelId, input.channelId),
              eq(chatMembers.role, "admin"),
            ),
          );

        if (admins.length === 1 && admins[0]!.memberId === input.memberId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A channel needs at least one admin.",
          });
        }
      }

      const updated = await ctx.db
        .update(chatMembers)
        .set({ role: input.role })
        .where(
          and(
            eq(chatMembers.channelId, input.channelId),
            eq(chatMembers.memberId, input.memberId),
          ),
        )
        .returning({ id: chatMembers.id });

      if (!updated.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "They aren't in this channel.",
        });
      }

      await ctx.audit.record(ctx.db, {
        action: "chat.member_role_changed",
        target: { id: input.channelId, label: `#${access.channel.name}` },
        metadata: { role: input.role },
      });

      return { ok: true };
    }),

  join: chatProcedure("chat.view", { audit: ["chat.member_added"] })
    .input(z.object({ channelId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const access = await readableChannel(ctx, input.channelId);

      if (access.membership) {
        ctx.audit.skipped("chat.member_added");

        return { ok: true };
      }

      await ctx.db
        .insert(chatMembers)
        .values({ channelId: input.channelId, memberId: access.memberId })
        .onConflictDoNothing();
      await ctx.audit.record(ctx.db, {
        action: "chat.member_added",
        target: { id: input.channelId, label: `#${access.channel.name}` },
        metadata: { joined: true },
      });

      return { ok: true };
    }),

  /** The caller's own settings for a conversation. */
  setPreferences: chatProcedure("chat.view")
    .input(
      z.object({
        channelId: uuid,
        notify: z.enum(["all", "mentions", "mute"]).optional(),
        notifyReplies: z.boolean().optional(),
        mutedUntil: z.coerce.date().nullable().optional(),
        pinned: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { channelId, ...values } = input;
      const memberId = await currentMemberId(ctx);
      const updated = await ctx.db
        .update(chatMembers)
        .set(values)
        .where(
          and(
            eq(chatMembers.channelId, channelId),
            eq(chatMembers.memberId, memberId),
          ),
        )
        .returning({ id: chatMembers.id });

      if (!updated.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Join the channel first.",
        });
      }

      return { ok: true };
    }),

  markRead: chatProcedure("chat.view")
    .input(z.object({ channelId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      await ctx.db
        .update(chatMembers)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(chatMembers.channelId, input.channelId),
            eq(chatMembers.memberId, memberId),
          ),
        );

      return { ok: true };
    }),
};
