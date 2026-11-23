import { and, eq, inArray, isNull } from "@zentro/db/drizzle";
import {
  chatChannels,
  chatMessages,
  docs,
  files,
  projects,
} from "@zentro/db/schema";

import { memberProfiles, readableChannelIds } from "../../chat";
import { visibleDocsCondition } from "../../access";
import { type OrganizationContext } from "../../trpc";
import { type ChatEntityRef, type Row } from "./types";

const internalRef =
  /(?:https?:\/\/([^\s/<>]+))?\/(docs|projects|files)\/([A-Za-z0-9_-]{2,80})(?![A-Za-z0-9_/-])/g;

const reservedDocSlugs = new Set([
  "my-docs",
  "recent",
  "projects",
  "trash",
  "search",
]);

function ownHosts() {
  const hosts = new Set<string>(["localhost:3000", "localhost:3100"]);

  for (const value of [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ]) {
    try {
      if (value) hosts.add(new URL(value).host);
    } catch {
      // ignore a malformed setting
    }
  }

  return hosts;
}

/** Docs, projects and files a body links to by address. */
export function internalRefsIn(body: string) {
  const hosts = ownHosts();
  const refs: Array<{ kind: "docs" | "projects" | "files"; key: string }> = [];

  for (const match of body.matchAll(internalRef)) {
    const [, host, kind, key] = match;

    if (host && !hosts.has(host)) continue;
    if (kind === "docs" && reservedDocSlugs.has(key!)) continue;

    refs.push({ kind: kind as "docs" | "projects" | "files", key: key! });
  }

  return refs.filter(
    (ref, index) =>
      refs.findIndex((r) => r.kind === ref.kind && r.key === ref.key) === index,
  );
}

const messageLink =
  /(?:https?:\/\/([^\s/<>]+))?\/chat\/(?:dm\/)?[\w-]+\?(?:[^\s<>]*&)?m=([0-9a-f-]{36})/g;

/** Ids of chat messages a body links to by address. */
export function messageLinksIn(body: string) {
  const hosts = ownHosts();
  const ids: string[] = [];

  for (const match of body.matchAll(messageLink)) {
    const [, host, id] = match;

    if (host && !hosts.has(host)) continue;

    ids.push(id!);
  }

  return [...new Set(ids)].slice(0, 3);
}

export function excerptOf(body: string) {
  const text = body
    .replace(/<@[0-9a-f-]{36}>/g, "@someone")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/** Cards for the docs, projects and files bodies link to, for this viewer. */
export async function resolveEntities(
  ctx: OrganizationContext,
  rows: Row[],
  memberId: string,
): Promise<Map<string, ChatEntityRef>> {
  const refs = rows.flatMap((row) => internalRefsIn(row.body));
  const found = new Map<string, ChatEntityRef>();
  const messageIds = [
    ...new Set(rows.flatMap((row) => messageLinksIn(row.body))),
  ];

  if (messageIds.length) {
    const readable = new Set(await readableChannelIds(ctx, memberId));
    const linked = await ctx.db
      .select({
        id: chatMessages.id,
        body: chatMessages.body,
        channelId: chatMessages.channelId,
        authorMemberId: chatMessages.authorMemberId,
        deletedAt: chatMessages.deletedAt,
        channelName: chatChannels.name,
      })
      .from(chatMessages)
      .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
      .where(
        and(
          eq(chatMessages.organizationId, ctx.activeOrganization.id),
          inArray(chatMessages.id, messageIds),
        ),
      );
    const authors = await memberProfiles(
      ctx,
      linked
        .map((row) => row.authorMemberId)
        .filter((id): id is string => Boolean(id)),
    );

    for (const row of linked) {
      const href = row.channelName
        ? `/chat/${row.channelName}?m=${row.id}`
        : `/chat/dm/${row.channelId}?m=${row.id}`;

      found.set(
        `messages:${row.id}`,
        row.deletedAt || !readable.has(row.channelId)
          ? { type: "missing", href }
          : {
              type: "message",
              id: row.id,
              title:
                (row.authorMemberId
                  ? authors.get(row.authorMemberId)?.name
                  : null) ?? "Someone",
              subtitle: row.channelName
                ? `#${row.channelName}`
                : "Direct message",
              excerpt: excerptOf(row.body),
              href,
            },
      );
    }
  }

  if (!refs.length) return found;

  const orgId = ctx.activeOrganization.id;
  const docSlugs = refs.filter((r) => r.kind === "docs").map((r) => r.key);
  const projectSlugs = refs
    .filter((r) => r.kind === "projects")
    .map((r) => r.key);
  const fileIds = refs
    .filter((r) => r.kind === "files" && /^[0-9a-f-]{36}$/.test(r.key))
    .map((r) => r.key);
  const enabled = await ctx.enabledModules();

  if (docSlugs.length && enabled.has("docs")) {
    const [all, visible] = await Promise.all([
      ctx.db
        .select({ id: docs.id, slug: docs.slug, title: docs.title })
        .from(docs)
        .where(
          and(
            eq(docs.organizationId, orgId),
            inArray(docs.slug, docSlugs),
            isNull(docs.deletedAt),
          ),
        ),
      ctx.db
        .select({ id: docs.id })
        .from(docs)
        .where(
          and(
            eq(docs.organizationId, orgId),
            inArray(docs.slug, docSlugs),
            isNull(docs.deletedAt),
            await visibleDocsCondition(ctx.permissions, "docs.view"),
          ),
        ),
    ]);
    const canOpen = new Set(visible.map((row) => row.id));

    for (const doc of all) {
      found.set(
        `docs:${doc.slug}`,
        canOpen.has(doc.id)
          ? {
              type: "doc",
              id: doc.id,
              title: doc.title || "Untitled",
              subtitle: "Doc",
              href: `/docs/${doc.slug}`,
            }
          : { type: "missing", href: `/docs/${doc.slug}` },
      );
    }
  }

  if (projectSlugs.length && enabled.has("projects")) {
    const viewable = new Set(
      await ctx.permissions.viewableProjectIds("projects.view"),
    );
    const all = await ctx.db
      .select({
        id: projects.id,
        slug: projects.slug,
        name: projects.name,
        key: projects.taskKeyPrefix,
        status: projects.status,
      })
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, orgId),
          inArray(projects.slug, projectSlugs),
        ),
      );

    for (const project of all) {
      found.set(
        `projects:${project.slug}`,
        viewable.has(project.id)
          ? {
              type: "project",
              id: project.id,
              title: project.name,
              subtitle: project.key ? `Project · ${project.key}` : "Project",
              status: project.status,
              href: `/projects/${project.slug}`,
            }
          : { type: "missing", href: `/projects/${project.slug}` },
      );
    }
  }

  if (fileIds.length) {
    const all = await ctx.db
      .select({
        id: files.id,
        name: files.name,
        mimeType: files.mimeType,
        size: files.size,
      })
      .from(files)
      .where(
        and(
          eq(files.organizationId, orgId),
          inArray(files.id, fileIds),
          isNull(files.deletedAt),
        ),
      );

    for (const file of all) {
      found.set(`files:${file.id}`, {
        type: "file",
        id: file.id,
        title: file.name,
        subtitle: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        mimeType: file.mimeType,
        href: `/api/files/${file.id}`,
      });
    }
  }

  return found;
}
