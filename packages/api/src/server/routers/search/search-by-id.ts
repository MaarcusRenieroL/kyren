import { and, eq, isNull, or } from "@zentro/db/drizzle";
import { chatChannels, docs, projects, tasks } from "@zentro/db/schema";
import { z } from "zod";
import { searchScope, searchProcedure } from "./scope";

export const searchByIdProcedure =   /** Quick lookup by ID, task key (e.g. ZEN-12), or slug. */
  searchProcedure
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
    });
