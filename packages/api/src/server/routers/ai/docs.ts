import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  type SQL,
} from "@kyren/db/drizzle";
import { docs, sprints, tasks, tickets, workLinks } from "@kyren/db/schema";
import { z } from "zod";

import { visibleDocsCondition } from "../../access";
import { likePattern } from "../../like";
import { loadProjectById } from "../../resources";
import {
  listProcedure,
  permissionProcedure,
  router,
  type OrganizationContext,
  type ScopeResolver,
} from "../../trpc";

/** The sprint's project, so the engine applies that project's visibility. */
const sprintProject: ScopeResolver = async ({ ctx, input }) => {
  const id = (input as { sprintId?: unknown } | null)?.sprintId;

  // Malformed ids are left for input validation to reject.
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return undefined;
  }

  const [sprint] = await ctx.db
    .select({ projectId: sprints.projectId })
    .from(sprints)
    .where(
      and(
        eq(sprints.id, id),
        eq(sprints.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);
  const project = await loadProjectById(ctx, sprint?.projectId);

  return project ? { project } : undefined;
};

async function canViewTickets(ctx: OrganizationContext) {
  const enabled = await ctx.enabledModules();

  if (!enabled.has("tickets")) return false;

  return (await ctx.permissions.check("tickets.view")).allowed;
}

/**
 * Assistant helpers. These are keyword heuristics and database summaries, not
 * calls to a model. Every result is limited to what the caller may see.
 */
  /** Keyword search across the tasks, docs and tickets the caller can see. */


export const aiDocsProcedures = {
  generateLivingSpec: permissionProcedure("docs.view", undefined, {
    module: "docs",
    also: ["tasks.view"],
  })
    .input(
      z.object({
        docSlug: z.string().min(1).max(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganization.id;
      const docScope = await visibleDocsCondition(ctx.permissions, "docs.view");

      const [doc] = await ctx.db
        .select()
        .from(docs)
        .where(
          and(
            eq(docs.organizationId, orgId),
            eq(docs.slug, input.docSlug),
            isNull(docs.deletedAt),
            docScope,
          ),
        )
        .limit(1);

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Doc not found." });
      }

      // Find all tasks linked to this document via workLinks
      const links = await ctx.db
        .select({
          targetId: workLinks.targetId,
          kind: workLinks.kind,
        })
        .from(workLinks)
        .where(
          and(
            eq(workLinks.organizationId, orgId),
            eq(workLinks.sourceId, doc.id),
          ),
        );

      const taskIds = links.map((l) => l.targetId);
      const taskProjects =
        await ctx.permissions.viewableProjectIds("tasks.view");
      const linkedTasks =
        taskIds.length && taskProjects.length
          ? await ctx.db
              .select()
              .from(tasks)
              .where(
                and(
                  eq(tasks.organizationId, orgId),
                  inArray(tasks.id, taskIds),
                  inArray(tasks.projectId, taskProjects),
                  isNull(tasks.deletedAt),
                ),
              )
          : [];

      const completed = linkedTasks.filter((t) => t.status === "done");
      const inProgress = linkedTasks.filter((t) => t.status === "in_progress");

      const summaryNote =
        `\n\n### Living Spec Update (${new Date().toISOString().split("T")[0]})\n` +
        `- **Completed Capabilities (${completed.length})**: ${completed.map((t) => `${t.key} (${t.name})`).join(", ") || "None"}\n` +
        `- **Active Implementation (${inProgress.length})**: ${inProgress.map((t) => `${t.key} (${t.name})`).join(", ") || "None"}\n`;

      return {
        docSlug: doc.slug,
        title: doc.title,
        linkedTaskCount: linkedTasks.length,
        completedTaskCount: completed.length,
        suggestedAppend: summaryNote,
      };
    }),

  /** A one-paragraph status of a sprint. */
};
