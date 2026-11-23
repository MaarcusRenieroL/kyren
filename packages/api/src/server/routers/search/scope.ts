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
} from "@kyren/db/drizzle";
import { chatChannels, docs, projects, tasks } from "@kyren/db/schema";
import { z } from "zod";

import { visibleDocsCondition } from "../../access";
import { likePattern } from "../../like";
import { listProcedure, router, type OrganizationContext } from "../../trpc";

/**
 * What the caller may find: each kind of result follows the same rules as its
 * own module, and nothing comes from a module that is turned off.
 */
export async function searchScope(ctx: OrganizationContext) {
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


export { searchProcedure };
