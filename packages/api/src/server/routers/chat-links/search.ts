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
} from "@zentro/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatMembers,
  chatMessages,
  docs,
  files,
  projects,
  tasks,
} from "@zentro/db/schema";
import { z } from "zod";
import { visibleDocsCondition } from "../../access";
import {
  currentMemberId,
  memberProfiles,
  normalizeChannelName,
  plainBody,
  readableChannelIds,
} from "../../chat";
import {
  chatProcedure,
  viewableItem,
  itemIdFromRef,
  discussionChannel,
  uuid,
  itemType,
  type Item,
} from "./helpers";
import { likePattern } from "../../like";

export const chatLinksSearchProcedures = {
  linkSearch: chatProcedure("chat.view")
    .input(z.object({ q: z.string().trim().max(60) }))
    .query(async ({ ctx, input }) => {
      const needle = `%${input.q.replace(/[%_\\]/g, "\\$&")}%`;
      const enabled = await ctx.enabledModules();
      const orgId = ctx.activeOrganization.id;
      const viewable = enabled.has("tasks")
        ? await ctx.permissions.viewableProjectIds("tasks.view")
        : [];
      const projectIds = enabled.has("projects")
        ? await ctx.permissions.viewableProjectIds("projects.view")
        : [];
      const [taskRows, docRows, projectRows] = await Promise.all([
        viewable.length
          ? ctx.db
              .select({
                key: tasks.key,
                name: tasks.name,
                status: tasks.status,
              })
              .from(tasks)
              .where(
                and(
                  eq(tasks.organizationId, orgId),
                  inArray(tasks.projectId, viewable),
                  isNull(tasks.deletedAt),
                  input.q
                    ? or(ilike(tasks.name, needle), ilike(tasks.key, needle))
                    : undefined,
                ),
              )
              .orderBy(desc(tasks.updatedAt))
              .limit(5)
          : [],
        enabled.has("docs")
          ? ctx.db
              .select({ slug: docs.slug, title: docs.title })
              .from(docs)
              .where(
                and(
                  eq(docs.organizationId, orgId),
                  isNull(docs.deletedAt),
                  await visibleDocsCondition(ctx.permissions, "docs.view"),
                  input.q ? ilike(docs.title, needle) : undefined,
                ),
              )
              .orderBy(desc(docs.updatedAt))
              .limit(5)
          : [],
        projectIds.length
          ? ctx.db
              .select({ slug: projects.slug, name: projects.name })
              .from(projects)
              .where(
                and(
                  eq(projects.organizationId, orgId),
                  inArray(projects.id, projectIds),
                  isNull(projects.deletedAt),
                  input.q ? ilike(projects.name, needle) : undefined,
                ),
              )
              .orderBy(asc(projects.name))
              .limit(4)
          : [],
      ]);

      return {
        tasks: taskRows,
        docs: docRows.map((doc) => ({
          title: doc.title || "Untitled",
          slug: doc.slug,
        })),
        projects: projectRows,
      };
    }),

  /**
   * The conversation about a task, doc or project, made on first use. It is
   * private to people who can open the item: anyone who can see the item and
   * opens its discussion is added.
   */
};
