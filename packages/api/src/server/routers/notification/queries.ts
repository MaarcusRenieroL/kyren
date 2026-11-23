import { fetchChatAndLinks } from "./chat-sources";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  like,
  ne,
  or,
  sql,
} from "@zentro/db/drizzle";
import {
  activityEvents,
  chatChannels,
  chatMembers,
  chatMessages,
  docComments,
  docs,
  members,
  notificationReads,
  taskComments,
  tasks,
  users,
  workLinks,
} from "@zentro/db/schema";
import type { TRPCContext } from "../../../types";
import { LIMIT } from "./types";

export async function fetchNotificationSources({
  db,
  user,
  activeOrganization,
  me,
  since,
  mentionPattern,
  taskProjects,
  docsVisible,
  canChat,
}: {
  db: TRPCContext["db"];
  user: NonNullable<TRPCContext["user"]>;
  activeOrganization: NonNullable<TRPCContext["activeOrganization"]>;
  me: { id: string };
  since: Date;
  mentionPattern: string | null;
  taskProjects: string[];
  docsVisible: any;
  canChat: boolean;
}) {
  const author = users.name;
  const [
    assignmentRows,
    unblockRows,
    taskCommentRows,
    docCommentRows,
    reads,
  ] = await Promise.all([
    taskProjects.length
      ? db
          .select({
            id: activityEvents.id,
            createdAt: activityEvents.createdAt,
            actor: users.name,
            key: tasks.key,
            name: tasks.name,
          })
          .from(activityEvents)
          .innerJoin(
            tasks,
            sql`${tasks.id}::text = ${activityEvents.targetId}`,
          )
          .leftJoin(users, eq(users.id, activityEvents.actorUserId))
          .where(
            and(
              eq(activityEvents.organizationId, activeOrganization.id),
              inArray(activityEvents.action, [
                "task.created",
                "task.assigned",
              ]),
              sql`${activityEvents.metadata}->>'assignedToMemberId' = ${me.id}`,
              or(
                isNull(activityEvents.actorUserId),
                ne(activityEvents.actorUserId, user.id),
              ),
              gte(activityEvents.createdAt, since),
              isNull(tasks.deletedAt),
              inArray(tasks.projectId, taskProjects),
            ),
          )
          .orderBy(desc(activityEvents.createdAt))
          .limit(LIMIT)
      : [],

    taskProjects.length
      ? db
          .select({
            id: activityEvents.id,
            createdAt: activityEvents.createdAt,
            actor: users.name,
            key: tasks.key,
            name: tasks.name,
            metadata: activityEvents.metadata,
          })
          .from(activityEvents)
          .innerJoin(
            tasks,
            sql`${tasks.id}::text = ${activityEvents.targetId}`,
          )
          .leftJoin(users, eq(users.id, activityEvents.actorUserId))
          .where(
            and(
              eq(activityEvents.organizationId, activeOrganization.id),
              eq(activityEvents.action, "task.unblocked"),
              sql`${activityEvents.metadata}->>'assignedToMemberId' = ${me.id}`,
              or(
                isNull(activityEvents.actorUserId),
                ne(activityEvents.actorUserId, user.id),
              ),
              gte(activityEvents.createdAt, since),
              isNull(tasks.deletedAt),
              inArray(tasks.projectId, taskProjects),
            ),
          )
          .orderBy(desc(activityEvents.createdAt))
          .limit(LIMIT)
      : [],

    taskProjects.length
      ? db
          .select({
            id: taskComments.id,
            body: taskComments.body,
            createdAt: taskComments.createdAt,
            actor: author,
            key: tasks.key,
            name: tasks.name,
            mine: sql<boolean>`(${tasks.assignedToMemberId} = ${me.id} or ${tasks.createdByMemberId} = ${me.id})`,
          })
          .from(taskComments)
          .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
          .leftJoin(members, eq(members.id, taskComments.authorMemberId))
          .leftJoin(users, eq(users.id, members.userId))
          .where(
            and(
              eq(taskComments.organizationId, activeOrganization.id),
              isNull(taskComments.deletedAt),
              isNull(tasks.deletedAt),
              gte(taskComments.createdAt, since),
              or(
                isNull(taskComments.authorMemberId),
                ne(taskComments.authorMemberId, me.id),
              ),
              inArray(tasks.projectId, taskProjects),
              or(
                eq(tasks.assignedToMemberId, me.id),
                eq(tasks.createdByMemberId, me.id),
                mentionPattern
                  ? ilike(taskComments.body, mentionPattern)
                  : sql`false`,
              ),
            ),
          )
          .orderBy(desc(taskComments.createdAt))
          .limit(LIMIT)
      : [],

    docsVisible
      ? db
          .select({
            id: docComments.id,
            body: docComments.body,
            createdAt: docComments.createdAt,
            actor: author,
            title: docs.title,
            slug: docs.slug,
            mine: sql<boolean>`(${docs.createdByMemberId} = ${me.id})`,
          })
          .from(docComments)
          .innerJoin(docs, eq(docs.id, docComments.docId))
          .leftJoin(members, eq(members.id, docComments.authorMemberId))
          .leftJoin(users, eq(users.id, members.userId))
          .where(
            and(
              eq(docComments.organizationId, activeOrganization.id),
              isNull(docComments.deletedAt),
              isNull(docs.deletedAt),
              gte(docComments.createdAt, since),
              or(
                isNull(docComments.authorMemberId),
                ne(docComments.authorMemberId, me.id),
              ),
              docsVisible,
              or(
                eq(docs.createdByMemberId, me.id),
                mentionPattern
                  ? ilike(docComments.body, mentionPattern)
                  : sql`false`,
              ),
            ),
          )
          .orderBy(desc(docComments.createdAt))
          .limit(LIMIT)
      : [],

    db
      .select({
        itemKey: notificationReads.itemKey,
        readAt: notificationReads.readAt,
      })
      .from(notificationReads)
      .where(
        and(
          eq(notificationReads.organizationId, activeOrganization.id),
          eq(notificationReads.userId, user.id),
        ),
      ),
  ]);

  const { chatRows, mentionLinks } = await fetchChatAndLinks({
    db,
    activeOrganization,
    me,
    since,
    taskProjects,
    canChat,
  });

  return {
    assignmentRows,
    unblockRows,
    taskCommentRows,
    docCommentRows,
    reads,
    chatRows,
    mentionLinks,
  };
}
