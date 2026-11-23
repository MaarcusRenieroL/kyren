import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, or, sql } from "@zentro/db/drizzle";
import {
  chatChannels,
  chatMembers,
  chatMessages,
  chatStatuses,
  members,
  sessions,
  users,
} from "@zentro/db/schema";
import type { OrganizationContext } from "../trpc";
export type ChannelAccess = {
  channel: typeof chatChannels.$inferSelect;
  /** The caller's membership, when they are in the conversation. */
  membership: typeof chatMembers.$inferSelect | null;
  memberId: string;
  canRead: boolean;
  canPost: boolean;
  canManage: boolean;
};

/** The caller's member id in the active organization. */
export async function currentMemberId(ctx: OrganizationContext) {
  const [member] = await ctx.db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.userId, ctx.user.id),
        eq(members.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!member) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
  }

  return member.id;
}

/**
 * What the caller may do in a conversation. Public channels can be read by
 * anyone with chat access; private channels and direct messages only by the
 * people in them. Archived channels are read-only.
 */
export async function channelAccess(
  ctx: OrganizationContext,
  channelId: string,
): Promise<ChannelAccess> {
  const memberId = await currentMemberId(ctx);
  const [row] = await ctx.db
    .select({ channel: chatChannels, membership: chatMembers })
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
        eq(chatChannels.id, channelId),
        eq(chatChannels.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found." });
  }

  const { channel, membership } = row;
  const [view, post, manageAny] = await Promise.all([
    ctx.permissions.can("chat.view"),
    ctx.permissions.can("chat.post"),
    ctx.permissions.can("chat.channels.manage"),
  ]);
  const isPublic =
    channel.kind === "channel" && channel.visibility === "public";
  const canRead = view && (Boolean(membership) || isPublic);
  const canManage =
    channel.kind === "channel" &&
    (membership?.role === "admin" || (manageAny && canRead));

  return {
    channel,
    membership,
    memberId,
    canRead,
    canPost: canRead && post && !channel.archivedAt,
    canManage,
  };
}

/** Throws unless the caller may read the conversation. */
export async function readableChannel(
  ctx: OrganizationContext,
  channelId: string,
) {
  const access = await channelAccess(ctx, channelId);

  if (!access.canRead) {
    // A private conversation looks the same as a missing one.
    throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found." });
  }

  return access;
}

/** Ids of every conversation the caller may read: theirs, plus public ones. */
export async function readableChannelIds(
  ctx: OrganizationContext,
  memberId: string,
) {
  if (!(await ctx.permissions.can("chat.view"))) return [];

  const rows = await ctx.db
    .select({ id: chatChannels.id })
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
        or(
          sql`${chatMembers.id} is not null`,
          and(
            eq(chatChannels.kind, "channel"),
            eq(chatChannels.visibility, "public"),
          ),
        ),
      ),
    );

  return rows.map((row) => row.id);
}

/** Members of the organization by id, with name and email. */
