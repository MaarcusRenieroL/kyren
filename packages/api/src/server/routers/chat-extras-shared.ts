import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "@kyren/db/drizzle";
import { chatChannels, chatMessages } from "@kyren/db/schema";
import { z } from "zod";
import { channelAccess } from "../chat";
import { permissionProcedure, type OrganizationContext } from "../trpc";

export const uuid = z.string().uuid();

export const chatProcedure = (
  permission: string,
  options: { also?: string[]; audit?: string[] } = {},
) => permissionProcedure(permission, undefined, { module: "chat", ...options });

/** Channel names for a conversation, for lists that span several. */
export async function channelLabels(
  ctx: OrganizationContext,
  channelIds: string[],
) {
  if (!channelIds.length)
    return new Map<string, { name: string | null; kind: string }>();

  const rows = await ctx.db
    .select({
      id: chatChannels.id,
      name: chatChannels.name,
      kind: chatChannels.kind,
    })
    .from(chatChannels)
    .where(inArray(chatChannels.id, [...new Set(channelIds)]));

  return new Map(
    rows.map((row) => [row.id, { name: row.name, kind: row.kind }]),
  );
}

export async function postableChannel(
  ctx: OrganizationContext,
  channelId: string,
) {
  const access = await channelAccess(ctx, channelId);

  if (!access.canPost) {
    throw new TRPCError({
      code: access.canRead ? "FORBIDDEN" : "NOT_FOUND",
      message: access.canRead ? "You can't post here." : "Channel not found.",
    });
  }

  return access;
}

export async function manageableChannel(
  ctx: OrganizationContext,
  channelId: string,
) {
  const access = await channelAccess(ctx, channelId);

  if (!access.canRead) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found." });
  }

  if (!access.canManage) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only channel admins can do that.",
    });
  }

  return access;
}

export const EMOJI_NAME = /^[a-z0-9_+-]{2,32}$/;

/**
 * A reply goes into the thread of a top-level message in the same channel and
 * organization; anything else would write into a thread the caller cannot read.
 */
export async function assertThreadParent(
  ctx: OrganizationContext,
  channelId: string,
  parentId: string | undefined,
) {
  if (!parentId) return;

  const [parent] = await ctx.db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.id, parentId),
        eq(chatMessages.organizationId, ctx.activeOrganization.id),
        eq(chatMessages.channelId, channelId),
        isNull(chatMessages.parentId),
      ),
    )
    .limit(1);

  if (!parent) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Reply in the thread of a message in this channel.",
    });
  }
}
