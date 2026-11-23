import { and, desc, eq, ilike, isNull, or } from "@kyren/db/drizzle";
import { chatChannels, docs, projects, tasks } from "@kyren/db/schema";
import { z } from "zod";
import { likePattern } from "../../like";
import { searchScope, searchProcedure, type SearchResult } from "./scope";

export const searchQueryProcedure = searchProcedure
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
    });
