import { TRPCError } from "@trpc/server";
import { and, eq } from "@zentro/db/drizzle";
import { chatChannels, chatMembers } from "@zentro/db/schema";
import { z } from "zod";

import { channelAccess, currentMemberId } from "../../chat";
import {
  addMembersHelper,
  channelName,
  chatProcedure,
  link,
  resolveLink,
  uuid,
} from "./helpers";

export const chatChannelMutationProcedures = {
  create: chatProcedure("chat.channels.create", {
    audit: ["chat.channel_created", "chat.member_added"],
    also: ["projects.view"],
  })
    .input(
      z.object({
        name: channelName,
        topic: z.string().trim().max(250).optional(),
        visibility: z.enum(["public", "private"]).default("public"),
        link: link.optional(),
        memberIds: z.array(uuid).max(200).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const linkValue = await resolveLink(ctx, input.link);
      const [taken] = await ctx.db
        .select({ id: chatChannels.id })
        .from(chatChannels)
        .where(
          and(
            eq(chatChannels.organizationId, ctx.activeOrganization.id),
            eq(chatChannels.name, input.name),
          ),
        )
        .limit(1);

      if (taken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `#${input.name} already exists. Pick another name.`,
        });
      }

      const channel = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(chatChannels)
          .values({
            organizationId: ctx.activeOrganization.id,
            kind: "channel",
            name: input.name,
            topic: input.topic || null,
            visibility: input.visibility,
            linkType: linkValue?.type ?? null,
            linkId: linkValue?.id ?? null,
            createdByMemberId: memberId,
          })
          .returning();

        // The creator runs the channel.
        await tx.insert(chatMembers).values({
          channelId: row!.id,
          memberId,
          role: "admin",
        });
        await ctx.audit.record(tx, {
          action: "chat.channel_created",
          target: { id: row!.id, label: `#${row!.name}` },
          metadata: {
            visibility: row!.visibility,
            ...(linkValue ? { link: linkValue.type } : {}),
          },
        });

        return row!;
      });
      const added = await addMembersHelper(
        ctx,
        channel.id,
        input.memberIds.filter((id) => id !== memberId),
      );

      if (added.length) {
        await ctx.audit.record(ctx.db, {
          action: "chat.member_added",
          target: { id: channel.id, label: `#${channel.name}` },
          metadata: { count: added.length },
        });
      } else {
        ctx.audit.skipped("chat.member_added");
      }

      return { id: channel.id, name: channel.name! };
    }),

  update: chatProcedure("chat.view", {
    audit: ["chat.channel_updated"],
    also: ["chat.channels.manage", "projects.view"],
  })
    .input(
      z.object({
        channelId: uuid,
        name: channelName.optional(),
        topic: z.string().trim().max(250).nullable().optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        visibility: z.enum(["public", "private"]).optional(),
        link: link.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await channelAccess(ctx, input.channelId);

      if (!access.canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel admins can change this channel.",
        });
      }

      const values: Partial<typeof chatChannels.$inferInsert> = {
        updatedAt: new Date(),
      };
      const fields: string[] = [];

      if (input.name !== undefined && input.name !== access.channel.name) {
        const [taken] = await ctx.db
          .select({ id: chatChannels.id })
          .from(chatChannels)
          .where(
            and(
              eq(chatChannels.organizationId, ctx.activeOrganization.id),
              eq(chatChannels.name, input.name),
            ),
          )
          .limit(1);

        if (taken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `#${input.name} already exists. Pick another name.`,
          });
        }

        values.name = input.name;
        fields.push("name");
      }

      if (input.topic !== undefined) {
        values.topic = input.topic || null;
        fields.push("topic");
      }

      if (input.description !== undefined) {
        values.description = input.description || null;
        fields.push("description");
      }

      if (input.visibility !== undefined) {
        values.visibility = input.visibility;
        fields.push("visibility");
      }

      if (input.link !== undefined) {
        const linkValue = await resolveLink(ctx, input.link);

        values.linkType = linkValue?.type ?? null;
        values.linkId = linkValue?.id ?? null;
        fields.push("link");
      }

      if (!fields.length) {
        ctx.audit.skipped("chat.channel_updated");

        return { ok: true };
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(chatChannels)
          .set(values)
          .where(eq(chatChannels.id, input.channelId));
        await ctx.audit.record(tx, {
          action: "chat.channel_updated",
          target: {
            id: input.channelId,
            label: `#${values.name ?? access.channel.name}`,
          },
          metadata: { fields },
        });
      });

      return { ok: true };
    }),
};
