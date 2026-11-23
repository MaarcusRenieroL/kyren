import { TRPCError } from "@trpc/server";
import {
  and,
  eq,
  isNull,
  sql,
} from "@kyren/db/drizzle";
import {
  chatEmojis,
  chatMessages,
  chatAttachments,
  files,
  mailAttachments,
} from "@kyren/db/schema";
import { z } from "zod";

import { currentMemberId, readableChannelIds } from "../../chat";
import { organizationLimits } from "../../platform-policy";
import {
  permissionProcedure,
  type OrganizationContext,
} from "../../trpc";
import { canSeeMessage } from "../mail";

/** Largest file a person can share in chat. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const uuid = z.string().uuid();

export const filesProcedure = (permission: string, audit?: string[]) =>
  permissionProcedure(permission, undefined, { module: "files", audit });

export const chatProcedure = (permission: string) =>
  permissionProcedure(permission, undefined, { module: "chat" });

export const mailProcedure = (permission: string) =>
  permissionProcedure(permission, undefined, { module: "mail" });

/** What one organization may store in total; `STORAGE_LIMIT_BYTES` overrides. */
export function storageLimitBytes() {
  const configured = Number(process.env.STORAGE_LIMIT_BYTES);

  return Number.isFinite(configured) && configured > 0
    ? configured
    : 1024 * 1024 * 1024;
}

export async function storageUsed(
  ctx: OrganizationContext,
  handle: Pick<OrganizationContext["db"], "select"> = ctx.db,
) {
  const [row] = await handle
    .select({
      used: sql<number>`coalesce(sum(${files.size}), 0)`.mapWith(Number),
    })
    .from(files)
    .where(
      and(
        eq(files.organizationId, ctx.activeOrganization.id),
        isNull(files.deletedAt),
      ),
    );

  return row?.used ?? 0;
}

/** The storage ceiling for the organization: an operator's override, else the default. */
export async function storageCeiling(ctx: OrganizationContext) {
  const { storageMb } = await organizationLimits(
    ctx.db,
    ctx.activeOrganization.id,
  );

  return storageMb ? storageMb * 1024 * 1024 : storageLimitBytes();
}

export async function assertRoom(
  ctx: OrganizationContext,
  size: number,
  handle: Pick<OrganizationContext["db"], "select"> = ctx.db,
) {
  if ((await storageUsed(ctx, handle)) + size > (await storageCeiling(ctx))) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message:
        "Your organization is out of file storage. Delete some files to make room.",
    });
  }
}

/** Conversations whose files the caller may see; none when Chat is off. */
export async function readableChannels(ctx: OrganizationContext, memberId: string) {
  const enabled = await ctx.enabledModules();

  return enabled.has("chat") ? readableChannelIds(ctx, memberId) : [];
}

/**
 * Whether the caller may open a file:
 * - their own upload;
 * - a file uploaded to the library, when they can view Files;
 * - a file attached to a live message in a conversation they can read;
 * - a custom emoji, which everyone using Chat sees.
 */
export async function canReadFile(ctx: OrganizationContext, fileId: string) {
  const memberId = await currentMemberId(ctx);
  const [file] = await ctx.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.organizationId, ctx.activeOrganization.id),
        isNull(files.deletedAt),
      ),
    )
    .limit(1);

  if (!file) return null;
  if (file.uploadedByMemberId === memberId) return file;

  const enabled = await ctx.enabledModules();

  // A mail attachment opens for whoever can read a message carrying it.
  if (file.source === "mail") {
    if (!enabled.has("mail") || !(await ctx.permissions.can("mail.view"))) {
      return null;
    }

    const carriers = await ctx.db
      .select({ messageId: mailAttachments.messageId })
      .from(mailAttachments)
      .where(eq(mailAttachments.fileId, fileId));

    for (const { messageId } of carriers) {
      if (await canSeeMessage(ctx, memberId, messageId)) return file;
    }

    return null;
  }

  if (enabled.has("chat") && (await ctx.permissions.can("chat.view"))) {
    const [emoji] = await ctx.db
      .select({ id: chatEmojis.id })
      .from(chatEmojis)
      .where(
        and(
          eq(chatEmojis.fileId, fileId),
          eq(chatEmojis.organizationId, ctx.activeOrganization.id),
        ),
      )
      .limit(1);

    if (emoji) return file;
  }

  const uses = await ctx.db
    .select({
      channelId: chatMessages.channelId,
      deletedAt: chatMessages.deletedAt,
    })
    .from(chatAttachments)
    .innerJoin(chatMessages, eq(chatMessages.id, chatAttachments.messageId))
    .where(eq(chatAttachments.fileId, fileId));

  if (
    file.source === "library" &&
    enabled.has("files") &&
    (await ctx.permissions.can("files.view"))
  ) {
    return file;
  }

  // A chat upload that was never sent stays with its uploader.
  if (!uses.length) return null;

  const readable = new Set(await readableChannels(ctx, memberId));

  return uses.some((use) => !use.deletedAt && readable.has(use.channelId))
    ? file
    : null;
}
