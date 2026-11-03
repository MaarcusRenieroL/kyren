import {
  chatChannels,
  chatMessages,
  docs,
  invitations,
  members,
  organizations,
  taskComments,
  tasks,
  users,
} from "@zentro/db/schema";
import { authenticatedProcedure, protectedProcedure, router } from "../trpc";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  or,
  sql,
} from "@zentro/db/drizzle";

import { visibleDocsCondition } from "../access";
import { currentMemberId, readableChannelIds } from "../chat";

/** The most rows of any one kind in an export. */
const EXPORT_LIMIT = 5000;

export const userRouter = router({
  // Session only: a new user has no active organization yet.
  listPendingInvites: authenticatedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;

    return ctx.db
      .select({
        id: invitations.id,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        role: invitations.role,
        invitedBy: users.name,
      })
      .from(invitations)
      .innerJoin(users, eq(users.id, invitations.inviterId))
      .innerJoin(
        organizations,
        eq(organizations.id, invitations.organizationId),
      )
      .where(
        and(
          sql`lower(${invitations.email}) = lower(${user.email})`,
          eq(invitations.status, "pending"),
          or(
            isNull(invitations.expiresAt),
            gt(invitations.expiresAt, new Date()),
          ),
        ),
      );
  }),

  /**
   * The caller's own words and work in the active organization, as one JSON
   * document. It holds what they wrote or created, limited to what they can
   * still see, so exporting never reveals more than the app already shows them.
   */
  exportMyData: protectedProcedure.query(async ({ ctx }) => {
    const { db, user, activeOrganization } = ctx;
    const memberId = await currentMemberId(ctx);
    const enabled = await ctx.enabledModules();
    const projectIds = enabled.has("tasks")
      ? await ctx.permissions.viewableProjectIds("tasks.view")
      : [];
    const docsVisible = enabled.has("docs")
      ? await visibleDocsCondition(ctx.permissions, "docs.view")
      : null;
    const channelIds = enabled.has("chat")
      ? await readableChannelIds(ctx, memberId)
      : [];

    const [member] = await db
      .select({ role: members.role, joinedAt: members.createdAt })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);

    const taskColumns = {
      key: tasks.key,
      name: tasks.name,
      status: tasks.status,
      priority: tasks.priority,
      dueAt: tasks.dueAt,
      createdAt: tasks.createdAt,
    };
    const live = and(
      eq(tasks.organizationId, activeOrganization.id),
      isNull(tasks.deletedAt),
      projectIds.length ? inArray(tasks.projectId, projectIds) : sql`false`,
    );

    const [tasksCreated, tasksAssigned, comments, messages, ownDocs] =
      await Promise.all([
        db
          .select(taskColumns)
          .from(tasks)
          .where(and(live, eq(tasks.createdByMemberId, memberId)))
          .orderBy(desc(tasks.createdAt))
          .limit(EXPORT_LIMIT),
        db
          .select(taskColumns)
          .from(tasks)
          .where(and(live, eq(tasks.assignedToMemberId, memberId)))
          .orderBy(desc(tasks.createdAt))
          .limit(EXPORT_LIMIT),
        db
          .select({
            taskKey: tasks.key,
            body: taskComments.body,
            createdAt: taskComments.createdAt,
          })
          .from(taskComments)
          .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
          .where(
            and(
              live,
              eq(taskComments.authorMemberId, memberId),
              isNull(taskComments.deletedAt),
            ),
          )
          .orderBy(desc(taskComments.createdAt))
          .limit(EXPORT_LIMIT),
        channelIds.length
          ? db
              .select({
                channel: chatChannels.name,
                body: chatMessages.body,
                createdAt: chatMessages.createdAt,
              })
              .from(chatMessages)
              .innerJoin(
                chatChannels,
                eq(chatChannels.id, chatMessages.channelId),
              )
              .where(
                and(
                  eq(chatMessages.organizationId, activeOrganization.id),
                  eq(chatMessages.authorMemberId, memberId),
                  inArray(chatMessages.channelId, channelIds),
                  isNull(chatMessages.deletedAt),
                ),
              )
              .orderBy(desc(chatMessages.createdAt))
              .limit(EXPORT_LIMIT)
          : [],
        docsVisible
          ? db
              .select({
                title: docs.title,
                slug: docs.slug,
                createdAt: docs.createdAt,
              })
              .from(docs)
              .where(
                and(
                  eq(docs.organizationId, activeOrganization.id),
                  eq(docs.createdByMemberId, memberId),
                  isNull(docs.deletedAt),
                  docsVisible,
                ),
              )
              .orderBy(desc(docs.createdAt))
              .limit(EXPORT_LIMIT)
          : [],
      ]);

    return {
      exportedAt: new Date().toISOString(),
      organization: activeOrganization.name,
      profile: { name: user.name, email: user.email },
      membership: member ?? null,
      tasksCreated,
      tasksAssigned,
      taskComments: comments,
      chatMessages: messages,
      docsCreated: ownDocs,
    };
  }),
});
