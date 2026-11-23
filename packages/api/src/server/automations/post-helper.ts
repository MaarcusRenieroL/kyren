import { and, eq } from "@kyren/db/drizzle";
import { chatChannels } from "@kyren/db/schema";
import { postChatMessage } from "../chat-post";
import type { Db } from "./types";

/**
 * Posts a line into a channel as an automation would: as the person who
 * caused it, or the channel's creator when nobody did. False when the channel
 * is gone or closed.
 */
export async function postFromAutomation(
  db: Db,
  input: {
    organizationId: string;
    channelId: string;
    actorMemberId?: string | null;
    text: string;
    parentId?: string | null;
  },
) {
  const [channel] = await db
    .select({
      id: chatChannels.id,
      createdBy: chatChannels.createdByMemberId,
      archivedAt: chatChannels.archivedAt,
    })
    .from(chatChannels)
    .where(
      and(
        eq(chatChannels.id, input.channelId),
        eq(chatChannels.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  const poster = input.actorMemberId ?? channel?.createdBy;

  if (!channel || channel.archivedAt || !poster) return false;

  await postChatMessage(db, {
    organizationId: input.organizationId,
    channelId: input.channelId,
    memberId: poster,
    parentId: input.parentId,
    body: input.text,
    kind: "event",
    meta: { event: "automation" },
  });

  return true;
}
