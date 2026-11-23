import { and, eq } from "@kyren/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatMembers,
  chatMessages,
  chatThreadFollows,
} from "@kyren/db/schema";

import type { DbHandle } from "./access";
import { queueMentionEmails } from "./chat-mention-mail";
import { syncMentions } from "./mentions";

export type PostInput = {
  organizationId: string;
  channelId: string;
  memberId: string;
  body: string;
  parentId?: string | null;
  clientId?: string | null;
  kind?: "message" | "poll" | "event" | "huddle";
  meta?: Record<string, unknown> | null;
  forwardedFromId?: string | null;
  fileIds?: string[];
  /** Join the channel when the author is not in it yet (public channels). */
  join?: boolean;
  createdAt?: Date;
};

/**
 * Writes one message and everything that follows from it: the channel's
 * last-message time, the author's read mark, task-key links, and thread
 * follows. Every way of posting (typing, scheduling, forwarding, polls,
 * activity events) goes through here so they behave the same.
 */
export async function postChatMessage(tx: DbHandle, input: PostInput) {
  const now = input.createdAt ?? new Date();

  if (input.join) {
    await tx
      .insert(chatMembers)
      .values({ channelId: input.channelId, memberId: input.memberId })
      .onConflictDoNothing();
  }

  const [message] = await tx
    .insert(chatMessages)
    .values({
      organizationId: input.organizationId,
      channelId: input.channelId,
      authorMemberId: input.memberId,
      parentId: input.parentId ?? null,
      clientId: input.clientId ?? null,
      body: input.body,
      kind: input.kind ?? "message",
      meta: input.meta ?? null,
      forwardedFromId: input.forwardedFromId ?? null,
      createdAt: now,
    })
    .returning();

  if (input.fileIds?.length) {
    await tx.insert(chatAttachments).values(
      input.fileIds.map((fileId, position) => ({
        messageId: message!.id,
        fileId,
        position,
      })),
    );
  }

  await tx
    .update(chatChannels)
    .set({ lastMessageAt: now })
    .where(eq(chatChannels.id, input.channelId));
  // What you send, you have read. A thread reply is not the channel's own
  // message, so it must not clear the channel's unread count.
  await tx
    .update(chatMembers)
    .set(
      input.parentId ? { typingAt: null } : { lastReadAt: now, typingAt: null },
    )
    .where(
      and(
        eq(chatMembers.channelId, input.channelId),
        eq(chatMembers.memberId, input.memberId),
      ),
    );

  await syncMentions(tx, {
    organizationId: input.organizationId,
    memberId: input.memberId,
    source: { type: "message", id: message!.id },
    text: input.body,
    via: "chat",
    mode: "replace",
  });
  // People it names hear about it by email if they don't read it soon,
  // queued with the message so a failed post never leaves one behind.
  await queueMentionEmails(tx, message!);

  // Replying starts following the thread, and so does being replied to.
  if (input.parentId) {
    const [parent] = await tx
      .select({ authorMemberId: chatMessages.authorMemberId })
      .from(chatMessages)
      .where(eq(chatMessages.id, input.parentId))
      .limit(1);
    const followers = new Set([input.memberId]);

    if (parent?.authorMemberId) followers.add(parent.authorMemberId);

    await tx
      .insert(chatThreadFollows)
      .values(
        [...followers].map((memberId) => ({
          memberId,
          parentId: input.parentId!,
          // Everyone else has not read this reply yet.
          lastReadAt:
            memberId === input.memberId ? now : new Date(now.getTime() - 1),
        })),
      )
      // An explicit unfollow stays unfollowed.
      .onConflictDoNothing();
  }

  return message!;
}
