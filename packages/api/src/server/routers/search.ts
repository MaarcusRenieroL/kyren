import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "@zentro/db/drizzle";
import { chatChannels, docs, projects, tasks } from "@zentro/db/schema";
import { z } from "zod";

import { visibleDocsCondition } from "../access";
import { likePattern } from "../like";
import { listProcedure, router, type OrganizationContext } from "../trpc";

/**
 * What the caller may find: each kind of result follows the same rules as its
 * own module, and nothing comes from a module that is turned off.
 */
async function searchScope(ctx: OrganizationContext) {
  const enabled = await ctx.enabledModules();
  const [taskProjects, projectIds, docScope, channels] = await Promise.all([
    enabled.has("tasks")
      ? ctx.permissions.viewableProjectIds("tasks.view")
      : [],
    enabled.has("projects")
      ? ctx.permissions.viewableProjectIds("projects.view")
      : [],
    enabled.has("docs")
      ? visibleDocsCondition(ctx.permissions, "docs.view")
      : undefined,
    enabled.has("chat")
      ? ctx.permissions.check("chat.view").then((d) => d.allowed)
      : false,
  ]);
  const none = sql`false`;

  return {
    tasks: taskProjects.length
      ? and(inArray(tasks.projectId, taskProjects), isNull(tasks.deletedAt))!
      : none,
    projects: projectIds.length ? inArray(projects.id, projectIds) : none,
    docs: (docScope as SQL | undefined) ?? none,
    // Only public channels are findable; private ones and DMs never are.
    channels: channels ? eq(chatChannels.visibility, "public") : none,
  };
}

const searchProcedure = listProcedure("tasks.view").meta({
  permissions: ["tasks.view", "projects.view", "docs.view", "chat.view"],
});

export type SearchResult = {
  id: string;
  type: "task" | "doc" | "project" | "channel";
  title: string;
  key?: string | null;
  snippet?: string | null;
  href: string;
};

export const searchRouter = router({
  /** Quick lookup by ID, task key (e.g. ZEN-12), or slug. */
  searchById: searchProcedure
    .input(z.object({ query: z.string().trim().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganization.id;
      const scope = await searchScope(ctx);
      const q = input.query.trim();

      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          q,
        );

      // 1. Check tasks by key or id
      const taskMatch = await ctx.db
        .select({ id: tasks.id, key: tasks.key, name: tasks.name })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, orgId),
            scope.tasks,
            isUuid ? or(eq(tasks.id, q), eq(tasks.key, q)) : eq(tasks.key, q),
          ),
        )
        .limit(1);

      if (taskMatch[0]) {
        return {
          id: taskMatch[0].id,
          type: "task" as const,
          title: taskMatch[0].name,
          key: taskMatch[0].key,
          href: `/tasks/${taskMatch[0].key}`,
        };
      }

      // 2. Check docs by slug or id
      const docMatch = await ctx.db
        .select({ id: docs.id, title: docs.title, slug: docs.slug })
        .from(docs)
        .where(
          and(
            eq(docs.organizationId, orgId),
            isNull(docs.deletedAt),
            scope.docs,
            isUuid ? or(eq(docs.id, q), eq(docs.slug, q)) : eq(docs.slug, q),
          ),
        )
        .limit(1);

      if (docMatch[0]) {
        return {
          id: docMatch[0].id,
          type: "doc" as const,
          title: docMatch[0].title,
          href: `/docs/${docMatch[0].slug}`,
        };
      }

      // 3. Check projects by slug, key prefix or id
      const projectMatch = await ctx.db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
          taskKeyPrefix: projects.taskKeyPrefix,
        })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, orgId),
            isNull(projects.deletedAt),
            scope.projects,
            isUuid
              ? or(
                  eq(projects.id, q),
                  eq(projects.slug, q),
                  eq(projects.taskKeyPrefix, q),
                )
              : or(eq(projects.slug, q), eq(projects.taskKeyPrefix, q)),
          ),
        )
        .limit(1);

      if (projectMatch[0]) {
        return {
          id: projectMatch[0].id,
          type: "project" as const,
          title: projectMatch[0].name,
          key: projectMatch[0].taskKeyPrefix,
          href: `/projects/${projectMatch[0].slug}`,
        };
      }

      // 4. Check chat channels by name
      const cleanChan = q.startsWith("#") ? q.slice(1) : q;
      const channelMatch = await ctx.db
        .select({ id: chatChannels.id, name: chatChannels.name })
        .from(chatChannels)
        .where(
          and(
            eq(chatChannels.organizationId, orgId),
            scope.channels,
            isUuid
              ? or(eq(chatChannels.id, q), eq(chatChannels.name, cleanChan))
              : eq(chatChannels.name, cleanChan),
          ),
        )
        .limit(1);

      if (channelMatch[0] && channelMatch[0].name) {
        return {
          id: channelMatch[0].id,
          type: "channel" as const,
          title: `#${channelMatch[0].name}`,
          href: `/chat/${channelMatch[0].name}`,
        };
      }

      return null;
    }),

  /** Universal search across tasks, docs, projects, and channels. */
  query: searchProcedure
    .input(
      z.object({
        query: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganization.id;
      const pattern = likePattern(input.query);
      const scope = await searchScope(ctx);
      const perTypeLimit = Math.max(3, Math.ceil(input.limit / 4));

      const [taskRows, docRows, projectRows, channelRows] = await Promise.all([
        ctx.db
          .select({
            id: tasks.id,
            key: tasks.key,
            name: tasks.name,
            status: tasks.status,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.organizationId, orgId),
              scope.tasks,
              or(ilike(tasks.name, pattern), ilike(tasks.key, pattern)),
            ),
          )
          .orderBy(desc(tasks.updatedAt))
          .limit(perTypeLimit),

        ctx.db
          .select({
            id: docs.id,
            title: docs.title,
            slug: docs.slug,
          })
          .from(docs)
          .where(
            and(
              eq(docs.organizationId, orgId),
              isNull(docs.deletedAt),
              scope.docs,
              ilike(docs.title, pattern),
            ),
          )
          .orderBy(desc(docs.updatedAt))
          .limit(perTypeLimit),

        ctx.db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            prefix: projects.taskKeyPrefix,
          })
          .from(projects)
          .where(
            and(
              eq(projects.organizationId, orgId),
              isNull(projects.deletedAt),
              scope.projects,
              or(
                ilike(projects.name, pattern),
                ilike(projects.taskKeyPrefix, pattern),
              ),
            ),
          )
          .orderBy(desc(projects.updatedAt))
          .limit(perTypeLimit),

        ctx.db
          .select({
            id: chatChannels.id,
            name: chatChannels.name,
            topic: chatChannels.topic,
          })
          .from(chatChannels)
          .where(
            and(
              eq(chatChannels.organizationId, orgId),
              scope.channels,
              or(
                ilike(chatChannels.name, pattern),
                ilike(chatChannels.topic, pattern),
              ),
            ),
          )
          .limit(perTypeLimit),
      ]);

      const results: SearchResult[] = [
        ...taskRows.map((t) => ({
          id: t.id,
          type: "task" as const,
          title: t.name,
          key: t.key,
          snippet: `Status: ${t.status}`,
          href: `/tasks/${t.key}`,
        })),
        ...docRows.map((d) => ({
          id: d.id,
          type: "doc" as const,
          title: d.title,
          href: `/docs/${d.slug}`,
        })),
        ...projectRows.map((p) => ({
          id: p.id,
          type: "project" as const,
          title: p.name,
          key: p.prefix,
          href: `/projects/${p.slug}`,
        })),
        ...channelRows
          .filter((c) => c.name)
          .map((c) => ({
            id: c.id,
            type: "channel" as const,
            title: `#${c.name}`,
            snippet: c.topic ?? undefined,
            href: `/chat/${c.name}`,
          })),
      ];

      return results.slice(0, input.limit);
    }),
});
