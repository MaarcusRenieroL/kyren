import type { TRPCContext } from "../../../types";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  ne,
  or,
  sql,
} from "@zentro/db/drizzle";
import {
  chatChannels,
  chatMembers,
  chatMessages,
  members,
  tasks,
  users,
  workLinks,
} from "@zentro/db/schema";
import { LIMIT } from "./types";

export async function fetchChatAndLinks({
  db,
  activeOrganization,
  me,
  since,
  taskProjects,
  canChat,
}: {
  db: TRPCContext["db"];
  activeOrganization: { id: string };
  me: { id: string };
  since: Date;
  taskProjects: string[];
  canChat: boolean;
}) {
  const chatRows = canChat
    ? await db
        .select({
          id: chatMessages.id,
          body: chatMessages.body,
          createdAt: chatMessages.createdAt,
          channelId: chatMessages.channelId,
          channelName: chatChannels.name,
          kind: chatChannels.kind,
          notify: chatMembers.notify,
          mutedUntil: chatMembers.mutedUntil,
          actor: users.name,
        })
        .from(chatMessages)
        .innerJoin(
          chatMembers,
          and(
            eq(chatMembers.channelId, chatMessages.channelId),
            eq(chatMembers.memberId, me.id),
          ),
        )
        .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
        .leftJoin(members, eq(members.id, chatMessages.authorMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(chatMessages.organizationId, activeOrganization.id),
            isNull(chatMessages.deletedAt),
            isNull(chatMessages.parentId),
            ne(chatMessages.authorMemberId, me.id),
            gte(chatMessages.createdAt, since),
            or(
              eq(chatChannels.kind, "dm"),
              like(chatMessages.body, `%<@${me.id}>%`),
              sql`${chatMessages.body} ~ '<!(channel|here)>'`,
            ),
          ),
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(LIMIT)
    : [];

  const mentionLinks = taskProjects.length
    ? await db
        .select({
          id: workLinks.id,
          createdAt: workLinks.createdAt,
          sourceType: workLinks.sourceType,
          sourceId: workLinks.sourceId,
          actor: users.name,
          key: tasks.key,
        })
        .from(workLinks)
        .innerJoin(tasks, eq(tasks.id, workLinks.targetId))
        .leftJoin(members, eq(members.id, workLinks.createdByMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(workLinks.organizationId, activeOrganization.id),
            eq(workLinks.kind, "mentions"),
            inArray(workLinks.via, ["content", "description"]),
            ne(workLinks.createdByMemberId, me.id),
            gte(workLinks.createdAt, since),
            isNull(tasks.deletedAt),
            inArray(tasks.projectId, taskProjects),
            or(
              eq(tasks.assignedToMemberId, me.id),
              eq(tasks.createdByMemberId, me.id),
            ),
          ),
        )
        .orderBy(desc(workLinks.createdAt))
        .limit(LIMIT)
    : [];


  return { chatRows, mentionLinks };
}
