import { and, desc, eq, inArray, isNull } from "@kyren/db/drizzle";
import { docs, tasks } from "@kyren/db/schema";
import { visibleDocsCondition } from "../../access";
import { protectedProcedure } from "../../trpc";
import { getCurrentMember } from "../task-helpers";
import {
  excerpt,
  mutedKindsFor,
  InboxItem,
  LIMIT,
  WINDOW_DAYS,
} from "./types";
import { fetchNotificationSources } from "./queries";

export const notificationListProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const { db, user, activeOrganization } = ctx;
    const me = await getCurrentMember(ctx);
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const firstName = (user.name ?? "").trim().split(/\s+/)[0] ?? "";
    const mentionPattern = firstName.length >= 2 ? `%@${firstName}%` : null;
    const mentions = (body: string) =>
      mentionPattern !== null &&
      new RegExp(
        `@${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      ).test(body);

    const enabled = await ctx.enabledModules();
    const taskProjects = enabled.has("tasks")
      ? await ctx.permissions.viewableProjectIds("tasks.view")
      : [];
    const docsVisible = enabled.has("docs")
      ? await visibleDocsCondition(ctx.permissions, "docs.view")
      : null;
    const canChat = await ctx.permissions.can("chat.view");

    const {
      assignmentRows,
      unblockRows,
      taskCommentRows,
      docCommentRows,
      reads,
      chatRows,
      mentionLinks,
    } = await fetchNotificationSources({
      db,
      user,
      activeOrganization,
      me,
      since,
      mentionPattern,
      taskProjects,
      docsVisible,
      canChat,
    });

    const allReadAt = reads.find((row) => row.itemKey === "*")?.readAt;
    const readKeys = new Set(reads.map((row) => row.itemKey));
    const items: Array<Omit<InboxItem, "unread">> = [];

    for (const row of assignmentRows) {
      items.push({
        id: `assign:${row.id}`,
        kind: "assignment",
        actor: row.actor ?? "Someone",
        verb: "assigned you",
        object: row.key,
        objectIsKey: true,
        title: row.name,
        quote: null,
        createdAt: row.createdAt,
        href: `/tasks/${row.key}`,
      });
    }

    for (const row of unblockRows) {
      const meta = row.metadata as Record<string, any>;
      const unblockedBy = meta?.unblockedByTaskKey;
      items.push({
        id: `unblock:${row.id}`,
        kind: "unblock",
        actor: row.actor ?? "Someone",
        verb: "unblocked",
        object: row.key,
        objectIsKey: true,
        title: row.name,
        quote: unblockedBy
          ? `Completed blocker ${unblockedBy}`
          : "All blockers resolved",
        createdAt: row.createdAt,
        href: `/tasks/${row.key}`,
      });
    }

    for (const row of taskCommentRows) {
      const mentioned = mentions(row.body);
      if (!mentioned && !row.mine) continue;
      items.push({
        id: `task-comment:${row.id}`,
        kind: mentioned ? "mention" : "comment",
        actor: row.actor ?? "Someone",
        verb: mentioned ? "mentioned you in" : "commented on",
        object: row.key,
        objectIsKey: true,
        title: row.name,
        quote: excerpt(row.body),
        createdAt: row.createdAt,
        href: `/tasks/${row.key}`,
      });
    }

    for (const row of chatRows) {
      if (
        row.notify === "mute" ||
        (row.mutedUntil && row.mutedUntil > new Date())
      ) {
        continue;
      }
      const mentioned =
        row.body.includes(`<@${me.id}>`) || /<!(channel|here)>/.test(row.body);
      if (row.kind === "channel" && row.notify === "mentions" && !mentioned) {
        continue;
      }
      items.push({
        id: `chat:${row.id}`,
        kind: mentioned ? "mention" : "comment",
        actor: row.actor ?? "Someone",
        verb: mentioned
          ? "mentioned you in"
          : row.kind === "dm"
            ? "sent you a message in"
            : "wrote in",
        object: row.kind === "dm" ? "Direct message" : `#${row.channelName}`,
        objectIsKey: false,
        title: null,
        quote: excerpt(
          row.body
            .replace(/<@[0-9a-f-]{36}>/g, "@you")
            .replace(/<!(channel|here)>/g, "@$1"),
        ),
        createdAt: row.createdAt,
        href:
          row.kind === "dm"
            ? `/chat/dm/${row.channelId}?m=${row.id}`
            : `/chat/${row.channelName}?m=${row.id}`,
      });
    }

    const sourceDocIds = mentionLinks
      .filter((row) => row.sourceType === "doc")
      .map((row) => row.sourceId);
    const sourceTaskIds = mentionLinks
      .filter((row) => row.sourceType === "task")
      .map((row) => row.sourceId);

    const [sourceDocs, sourceTasks] = await Promise.all([
      sourceDocIds.length && docsVisible
        ? db
            .select({ id: docs.id, title: docs.title, slug: docs.slug })
            .from(docs)
            .where(
              and(
                inArray(docs.id, sourceDocIds),
                isNull(docs.deletedAt),
                docsVisible,
              ),
            )
        : [],
      sourceTaskIds.length
        ? db
            .select({ id: tasks.id, key: tasks.key })
            .from(tasks)
            .where(
              and(
                inArray(tasks.id, sourceTaskIds),
                isNull(tasks.deletedAt),
                inArray(tasks.projectId, taskProjects),
              ),
            )
        : [],
    ]);

    for (const row of mentionLinks) {
      const doc = sourceDocs.find((entry) => entry.id === row.sourceId);
      const task = sourceTasks.find((entry) => entry.id === row.sourceId);
      const where = doc
        ? {
            object: doc.title || "Untitled",
            isKey: false,
            href: `/docs/${doc.slug}`,
          }
        : task
          ? { object: task.key, isKey: true, href: `/tasks/${task.key}` }
          : null;

      if (!where) continue;

      items.push({
        id: `link:${row.id}`,
        kind: "mention",
        actor: row.actor ?? "Someone",
        verb: `linked ${row.key} in`,
        object: where.object,
        objectIsKey: where.isKey,
        title: null,
        quote: null,
        createdAt: row.createdAt,
        href: where.href,
      });
    }

    for (const row of docCommentRows) {
      const mentioned = mentions(row.body);
      if (!mentioned && !row.mine) continue;
      items.push({
        id: `doc-comment:${row.id}`,
        kind: mentioned ? "mention" : "comment",
        actor: row.actor ?? "Someone",
        verb: mentioned ? "mentioned you in" : "commented on",
        object: row.title || "Untitled",
        objectIsKey: false,
        title: null,
        quote: excerpt(row.body),
        createdAt: row.createdAt,
        href: `/docs/${row.slug}`,
      });
    }

    const muted = new Set(await mutedKindsFor(ctx));

    return items
      .filter((item) => !muted.has(item.kind))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, LIMIT)
      .map(
        (item): InboxItem => ({
          ...item,
          unread:
            !readKeys.has(item.id) &&
            !(allReadAt && item.createdAt <= allReadAt),
        }),
      );
  },
);
