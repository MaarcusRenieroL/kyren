import { and, desc, eq, inArray, isNull, or, type SQL } from "@zentro/db/drizzle";
import {
  chatChannels,
  chatMessages,
  docs,
  members,
  projects,
  tasks,
  users,
  workLinks,
} from "@zentro/db/schema";
import { visibleDocsCondition } from "../../access";
import { currentMemberId, readableChannelIds } from "../../chat";
import type { OrganizationContext } from "../../trpc";
import {
  type LinkedItem,
  type LinkRelation,
  type Ref,
  relationFor,
} from "./types";

export async function linksOf(
  ctx: OrganizationContext,
  self: Ref,
): Promise<LinkedItem[]> {
  const { db, activeOrganization } = ctx;
  const rows = await db
    .select()
    .from(workLinks)
    .where(
      and(
        eq(workLinks.organizationId, activeOrganization.id),
        or(
          and(
            eq(workLinks.sourceType, self.type),
            eq(workLinks.sourceId, self.id),
          ),
          and(
            eq(workLinks.targetType, self.type),
            eq(workLinks.targetId, self.id),
          ),
        ),
      ),
    );

  if (!rows.length) return [];

  const other = (row: (typeof rows)[number]): Ref =>
    row.sourceType === self.type && row.sourceId === self.id
      ? { type: row.targetType as Ref["type"], id: row.targetId }
      : { type: row.sourceType as Ref["type"], id: row.sourceId };
  const taskIds = rows
    .map(other)
    .filter((ref) => ref.type === "task")
    .map((ref) => ref.id);
  const docIds = rows
    .map(other)
    .filter((ref) => ref.type === "doc")
    .map((ref) => ref.id);
  const messageIds = rows
    .map(other)
    .filter((ref) => ref.type === "message")
    .map((ref) => ref.id);
  const enabled = await ctx.enabledModules();

  // Chat messages that name this task, from conversations the caller can read.
  const messageRows =
    messageIds.length && enabled.has("chat")
      ? await (async () => {
          const readable = await readableChannelIds(
            ctx,
            await currentMemberId(ctx),
          );

          if (!readable.length) return [];

          return db
            .select({
              id: chatMessages.id,
              body: chatMessages.body,
              channelId: chatMessages.channelId,
              channelName: chatChannels.name,
              kind: chatChannels.kind,
            })
            .from(chatMessages)
            .innerJoin(
              chatChannels,
              eq(chatChannels.id, chatMessages.channelId),
            )
            .where(
              and(
                inArray(chatMessages.id, messageIds),
                inArray(chatMessages.channelId, readable),
                isNull(chatMessages.deletedAt),
              ),
            );
        })()
      : [];

  const [taskRows, docRows] = await Promise.all([
    taskIds.length && enabled.has("tasks")
      ? (async () => {
          const viewable =
            await ctx.permissions.viewableProjectIds("tasks.view");

          if (!viewable.length) return [];

          return db
            .select({
              id: tasks.id,
              key: tasks.key,
              name: tasks.name,
              status: tasks.status,
              assignee: users.name,
              priority: tasks.priority,
              estimatePoints: tasks.estimatePoints,
            })
            .from(tasks)
            .leftJoin(members, eq(members.id, tasks.assignedToMemberId))
            .leftJoin(users, eq(users.id, members.userId))
            .where(
              and(
                eq(tasks.organizationId, activeOrganization.id),
                inArray(tasks.id, taskIds),
                inArray(tasks.projectId, viewable),
                isNull(tasks.deletedAt),
              ),
            );
        })()
      : [],
    docIds.length && enabled.has("docs")
      ? (async () =>
          db
            .select({
              id: docs.id,
              title: docs.title,
              slug: docs.slug,
              projectKey: projects.taskKeyPrefix,
            })
            .from(docs)
            .leftJoin(projects, eq(projects.id, docs.projectId))
            .where(
              and(
                eq(docs.organizationId, activeOrganization.id),
                inArray(docs.id, docIds),
                isNull(docs.deletedAt),
                await visibleDocsCondition(ctx.permissions, "docs.view"),
              ),
            ))()
      : [],
  ]);

  const items: LinkedItem[] = [];

  for (const row of rows) {
    const ref = other(row);
    const base = {
      linkId: row.id,
      relation: relationFor(row, self),
      auto: row.kind === "mentions" && row.via !== null,
    };

    if (ref.type === "task") {
      const task = taskRows.find((entry) => entry.id === ref.id);

      if (task) {
        items.push({
          ...base,
          type: "task",
          id: task.id,
          title: task.name,
          key: task.key,
          status: task.status,
          assignee: task.assignee,
          priority: task.priority,
          estimatePoints: task.estimatePoints,
          href: `/tasks/${task.key}`,
        });
      }
    } else if (ref.type === "message") {
      const message = messageRows.find((entry) => entry.id === ref.id);

      if (message) {
        const text = message.body
          .replace(/<@[0-9a-f-]{36}>/g, "@someone")
          .replace(/\s+/g, " ")
          .trim();

        items.push({
          ...base,
          type: "message",
          id: message.id,
          title: text.length > 90 ? `${text.slice(0, 87)}…` : text,
          key:
            message.kind === "dm"
              ? "Direct message"
              : `#${message.channelName}`,
          status: null,
          assignee: null,
          href:
            message.kind === "dm"
              ? `/chat/dm/${message.channelId}?m=${message.id}`
              : `/chat/${message.channelName}?m=${message.id}`,
        });
      }
    } else {
      const doc = docRows.find((entry) => entry.id === ref.id);

      if (doc) {
        items.push({
          ...base,
          type: "doc",
          id: doc.id,
          title: doc.title || "Untitled",
          key: doc.projectKey,
          status: null,
          assignee: null,
          href: `/docs/${doc.slug}`,
        });
      }
    }
  }

  return items;
}

export async function loadTask(ctx: OrganizationContext, key: string) {
  const [task] = await ctx.db
    .select({
      id: tasks.id,
      key: tasks.key,
      projectId: tasks.projectId,
      teamId: tasks.teamId,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, ctx.activeOrganization.id),
        eq(tasks.key, key),
        isNull(tasks.deletedAt),
      ),
    )
    .limit(1);

  return task;
}

export async function loadDoc(ctx: OrganizationContext, id: string) {
  const [doc] = await ctx.db
    .select({
      id: docs.id,
      title: docs.title,
      projectId: docs.projectId,
      teamId: docs.teamId,
    })
    .from(docs)
    .where(
      and(
        eq(docs.organizationId, ctx.activeOrganization.id),
        eq(docs.id, id),
        isNull(docs.deletedAt),
      ),
    )
    .limit(1);

  return doc;
}

/** The other end must exist and be visible to the caller. */
