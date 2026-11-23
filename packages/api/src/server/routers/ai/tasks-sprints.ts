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

export const aiTasksSprintsProcedures = {
  suggestStoryPoints: permissionProcedure("tasks.create", undefined, {
    module: "tasks",
  })
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(10_000).optional(),
      }),
    )
    .query(async ({ input }) => {
      const text = `${input.title} ${input.description ?? ""}`.toLowerCase();
      let points = 2; // Default baseline

      const complexSignals = [
        "refactor",
        "migrate",
        "architecture",
        "redesign",
        "protocol",
        "encryption",
        "engine",
        "performance",
        "webrtc",
        "concurrency",
      ];
      const mediumSignals = [
        "create",
        "build",
        "integrate",
        "endpoint",
        "modal",
        "page",
        "table",
        "filter",
      ];
      const smallSignals = [
        "fix",
        "typo",
        "color",
        "copy",
        "tweak",
        "padding",
        "margin",
        "button",
        "link",
      ];

      let matchCount = 0;
      for (const signal of complexSignals) {
        if (text.includes(signal)) matchCount += 3;
      }
      for (const signal of mediumSignals) {
        if (text.includes(signal)) matchCount += 2;
      }
      for (const signal of smallSignals) {
        if (text.includes(signal)) matchCount -= 1;
      }

      if (matchCount >= 6) points = 8;
      else if (matchCount >= 4) points = 5;
      else if (matchCount >= 2) points = 3;
      else if (matchCount <= 0) points = 1;

      return {
        points,
        rationale: `Estimated ${points} story points from keywords in the title and description.`,
      };
    }),

  /** Keyword-based triage of a ticket's text. */
  sprintBriefing: permissionProcedure("tasks.view", sprintProject, {
    module: "tasks",
  })
    .input(
      z.object({
        sprintId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganization.id;

      const [sprint] = await ctx.db
        .select()
        .from(sprints)
        .where(
          and(
            eq(sprints.id, input.sprintId),
            eq(sprints.organizationId, orgId),
          ),
        )
        .limit(1);

      if (!sprint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sprint not found.",
        });
      }

      const sprintTasks = await ctx.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.sprintId, input.sprintId),
            eq(tasks.organizationId, orgId),
            isNull(tasks.deletedAt),
          ),
        );

      const total = sprintTasks.length;
      const done = sprintTasks.filter((t) => t.status === "done").length;
      const blocked = sprintTasks.filter(
        (t) => t.priority === "urgent" && t.status !== "done",
      ).length;
      const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

      const health =
        progressPercent >= 70
          ? "on_track"
          : progressPercent >= 40
            ? "at_risk"
            : "behind";

      return {
        sprintName: sprint.name,
        health,
        metrics: {
          totalTasks: total,
          completedTasks: done,
          blockedOrUrgent: blocked,
          completionRate: `${progressPercent}%`,
        },
        executiveSummary: `Sprint "${sprint.name}" is currently ${health.replace("_", " ")} at ${progressPercent}% completion (${done}/${total} tasks finished, ${blocked} urgent items pending).`,
      };
    }),
};
