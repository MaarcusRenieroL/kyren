import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "@kyren/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatMembers,
  chatMessages,
  docs,
  files,
  projects,
  tasks,
} from "@kyren/db/schema";
import { z } from "zod";

import { visibleDocsCondition } from "../../access";
import {
  currentMemberId,
  memberProfiles,
  normalizeChannelName,
  readableChannelIds,
} from "../../chat";
import { loadProjectById } from "../../resources";
import {
  denialFor,
  permissionProcedure,
  type OrganizationContext,
} from "../../trpc";

export const uuid = z.string().uuid();
export const itemType = z.enum(["task", "doc", "project"]);

export type Item = {
  type: "task" | "doc" | "project";
  id: string;
  /** A short, name-safe label for the channel. */
  slug: string;
  title: string;
  href: string;
};

export const chatProcedure = (
  permission: string,
  options: { also?: string[]; audit?: string[] } = {},
) => permissionProcedure(permission, undefined, { module: "chat", ...options });

/** The item, if the caller may open it; otherwise a not-found error. */
export async function viewableItem(
  ctx: OrganizationContext,
  type: Item["type"],
  id: string,
): Promise<Item> {
  const orgId = ctx.activeOrganization.id;
  const missing = new TRPCError({
    code: "NOT_FOUND",
    message: "That item was not found.",
  });

  if (type === "task") {
    const [task] = await ctx.db
      .select({
        id: tasks.id,
        key: tasks.key,
        name: tasks.name,
        projectId: tasks.projectId,
        teamId: tasks.teamId,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, id),
          eq(tasks.organizationId, orgId),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);

    if (!task) throw missing;

    const decision = await ctx.permissions.check("tasks.view", {
      project: (await loadProjectById(ctx, task.projectId)) ?? null,
      teamId: task.teamId,
    });

    if (!decision.allowed) throw denialFor(decision);

    return {
      type,
      id: task.id,
      slug: `task-${task.key}`,
      title: task.name,
      href: `/tasks/${task.key}`,
    };
  }

  if (type === "doc") {
    const [doc] = await ctx.db
      .select({ id: docs.id, slug: docs.slug, title: docs.title })
      .from(docs)
      .where(
        and(
          eq(docs.id, id),
          eq(docs.organizationId, orgId),
          isNull(docs.deletedAt),
          await visibleDocsCondition(ctx.permissions, "docs.view"),
        ),
      )
      .limit(1);

    if (!doc) throw missing;

    return {
      type,
      id: doc.id,
      slug: `doc-${doc.slug}`,
      title: doc.title || "Untitled",
      href: `/docs/${doc.slug}`,
    };
  }

  const project = await loadProjectById(ctx, id);

  if (!project) throw missing;

  const decision = await ctx.permissions.check("projects.view", { project });

  if (!decision.allowed) throw denialFor(decision);

  const [row] = await ctx.db
    .select({ id: projects.id, slug: projects.slug, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, orgId)))
    .limit(1);

  if (!row) throw missing;

  return {
    type,
    id: row.id,
    slug: `project-${row.slug}`,
    title: row.name,
    href: `/projects/${row.slug}`,
  };
}

/** The id behind a task key or a doc or project slug. */
export async function itemIdFromRef(
  ctx: OrganizationContext,
  type: Item["type"],
  ref: string,
) {
  const orgId = ctx.activeOrganization.id;
  const [row] =
    type === "task"
      ? await ctx.db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.organizationId, orgId), eq(tasks.key, ref)))
          .limit(1)
      : type === "doc"
        ? await ctx.db
            .select({ id: docs.id })
            .from(docs)
            .where(and(eq(docs.organizationId, orgId), eq(docs.slug, ref)))
            .limit(1)
        : await ctx.db
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(eq(projects.organizationId, orgId), eq(projects.slug, ref)),
            )
            .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That item was not found.",
    });
  }

  return row.id;
}

/**
 * The oldest channel linked to the item that the caller may open: a public
 * one, the item's own discussion, or one they already belong to. Any other
 * private channel is never found, joined or described for someone outside it.
 */
export async function discussionChannel(
  ctx: OrganizationContext,
  item: Item,
  memberId: string,
) {
  const [existing] = await ctx.db
    .select({ channel: chatChannels })
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
        eq(chatChannels.linkType, item.type),
        eq(chatChannels.linkId, item.id),
        eq(chatChannels.kind, "channel"),
        or(
          eq(chatChannels.visibility, "public"),
          eq(chatChannels.discussion, true),
          isNotNull(chatMembers.id),
        ),
      ),
    )
    .orderBy(asc(chatChannels.createdAt))
    .limit(1);

  return existing?.channel ?? null;
}

