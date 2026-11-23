import { and, asc, eq, inArray, isNull, or, sql } from "@kyren/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatLinkPreviews,
  chatMessages,
  chatPolls,
  chatPollVotes,
  chatReactions,
  chatSaved,
  files,
  members,
  tasks,
  users,
  workLinks,
} from "@kyren/db/schema";

import {
  memberProfiles,
  mentionedMemberIds,
  readableChannelIds,
} from "../../chat";
import { taskKeysIn } from "../../mentions";
import { externalUrls } from "../../chat-unfurl";
import { type OrganizationContext } from "../../trpc";
import { resolveEntities } from "./refs";
import { type Row } from "./types";

export async function loadHydrationData(
  ctx: OrganizationContext,
  rows: Row[],
  memberId: string,
  options: { withReplies?: boolean } = {},
) {
  const ids = rows.map((row) => row.id);
  const [reactionRows, attachmentRows, replyRows] = await Promise.all([
    ctx.db
      .select({
        messageId: chatReactions.messageId,
        emoji: chatReactions.emoji,
        memberId: chatReactions.memberId,
      })
      .from(chatReactions)
      .where(inArray(chatReactions.messageId, ids))
      .orderBy(asc(chatReactions.createdAt)),
    ctx.db
      .select({
        messageId: chatAttachments.messageId,
        id: files.id,
        name: files.name,
        mimeType: files.mimeType,
        size: files.size,
        width: files.width,
        height: files.height,
      })
      .from(chatAttachments)
      .innerJoin(files, eq(files.id, chatAttachments.fileId))
      .where(
        and(inArray(chatAttachments.messageId, ids), isNull(files.deletedAt)),
      )
      .orderBy(asc(chatAttachments.position)),
    options.withReplies
      ? ctx.db
          .select({
            parentId: chatMessages.parentId,
            count: sql<number>`count(*)`.mapWith(Number),
            lastAt: sql<Date>`max(${chatMessages.createdAt})`.mapWith(
              chatMessages.createdAt,
            ),
            people: sql<
              string[]
            >`array_agg(distinct ${chatMessages.authorMemberId}::text)`,
          })
          .from(chatMessages)
          .where(
            and(
              inArray(chatMessages.parentId, ids),
              isNull(chatMessages.deletedAt),
            ),
          )
          .groupBy(chatMessages.parentId)
      : [],
  ]);

  const peopleIds = new Set<string>();

  for (const row of rows) {
    if (row.authorMemberId) peopleIds.add(row.authorMemberId);
    mentionedMemberIds(row.body).forEach((id) => peopleIds.add(id));
  }

  reactionRows.forEach((row) => peopleIds.add(row.memberId));
  replyRows.forEach((row) =>
    row.people.forEach((id) => id && peopleIds.add(id)),
  );

  const profiles = await memberProfiles(ctx, [...peopleIds]);

  const createdLinks = await ctx.db
    .select({ messageId: workLinks.sourceId, taskId: workLinks.targetId })
    .from(workLinks)
    .where(
      and(
        eq(workLinks.organizationId, ctx.activeOrganization.id),
        eq(workLinks.sourceType, "message"),
        eq(workLinks.targetType, "task"),
        eq(workLinks.kind, "relates"),
        inArray(workLinks.sourceId, ids),
      ),
    );

  const keys = [...new Set(rows.flatMap((row) => taskKeysIn(row.body)))];
  const enabled = await ctx.enabledModules();
  const viewable =
    (keys.length || createdLinks.length) && enabled.has("tasks")
      ? await ctx.permissions.viewableProjectIds("tasks.view")
      : [];
  const taskRows = viewable.length
    ? await ctx.db
        .select({
          id: tasks.id,
          key: tasks.key,
          name: tasks.name,
          status: tasks.status,
          assignee: users.name,
        })
        .from(tasks)
        .leftJoin(members, eq(members.id, tasks.assignedToMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(tasks.organizationId, ctx.activeOrganization.id),
            or(
              keys.length ? inArray(tasks.key, keys) : undefined,
              createdLinks.length
                ? inArray(
                    tasks.id,
                    createdLinks.map((link) => link.taskId),
                  )
                : undefined,
            ),
            inArray(tasks.projectId, viewable),
            isNull(tasks.deletedAt),
          ),
        )
    : [];

  const readableIds = new Set(await readableChannelIds(ctx, memberId));
  const forwardIds = rows
    .map((row) => row.forwardedFromId)
    .filter((id): id is string => Boolean(id));
  const urls = [...new Set(rows.flatMap((row) => externalUrls(row.body)))];
  const [savedRows, pollRows, forwardRows, previewRows, entityMap] =
    await Promise.all([
      ctx.db
        .select({
          messageId: chatSaved.messageId,
          remindAt: chatSaved.remindAt,
        })
        .from(chatSaved)
        .where(
          and(
            eq(chatSaved.memberId, memberId),
            inArray(chatSaved.messageId, ids),
          ),
        ),
      ctx.db.select().from(chatPolls).where(inArray(chatPolls.messageId, ids)),
      forwardIds.length
        ? ctx.db
            .select({
              id: chatMessages.id,
              channelId: chatMessages.channelId,
              body: chatMessages.body,
              authorMemberId: chatMessages.authorMemberId,
              deletedAt: chatMessages.deletedAt,
              channelName: chatChannels.name,
            })
            .from(chatMessages)
            .innerJoin(
              chatChannels,
              eq(chatChannels.id, chatMessages.channelId),
            )
            .where(inArray(chatMessages.id, forwardIds))
        : [],
      urls.length
        ? ctx.db
            .select()
            .from(chatLinkPreviews)
            .where(
              and(
                eq(chatLinkPreviews.organizationId, ctx.activeOrganization.id),
                inArray(chatLinkPreviews.url, urls),
                eq(chatLinkPreviews.failed, false),
              ),
            )
        : [],
      resolveEntities(ctx, rows, memberId),
    ]);
  const voteRows = pollRows.length
    ? await ctx.db
        .select()
        .from(chatPollVotes)
        .where(
          inArray(
            chatPollVotes.pollId,
            pollRows.map((poll) => poll.id),
          ),
        )
    : [];
  const voterProfiles = await memberProfiles(
    ctx,
    voteRows.map((vote) => vote.memberId),
  );
  const forwardAuthors = await memberProfiles(
    ctx,
    forwardRows
      .map((row) => row.authorMemberId)
      .filter((id): id is string => Boolean(id)),
  );

  return {
    reactionRows,
    attachmentRows,
    replyRows,
    profiles,
    createdLinks,
    taskRows,
    readableIds,
    savedRows,
    pollRows,
    forwardRows,
    previewRows,
    entityMap,
    voteRows,
    voterProfiles,
    forwardAuthors,
  };
}
