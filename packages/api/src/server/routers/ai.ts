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
} from "@zentro/db/drizzle";
import { docs, sprints, tasks, tickets, workLinks } from "@zentro/db/schema";
import { z } from "zod";

import { visibleDocsCondition } from "../access";
import { likePattern } from "../like";
import { loadProjectById } from "../resources";
import {
  listProcedure,
  permissionProcedure,
  router,
  type OrganizationContext,
  type ScopeResolver,
} from "../trpc";

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
export const aiRouter = router({
  /** Keyword search across the tasks, docs and tickets the caller can see. */
  semanticSearch: listProcedure("tasks.view")
    .meta({ permissions: ["tasks.view", "docs.view", "tickets.view"] })
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(30).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganization.id;
      const trimmed = input.query.trim();
      const pattern = likePattern(trimmed);
      const keywords = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
      const kwPatterns = keywords.map(likePattern);
      const enabled = await ctx.enabledModules();
      // Each kind of result only comes from where the caller may look.
      const taskProjects = enabled.has("tasks")
        ? await ctx.permissions.viewableProjectIds("tasks.view")
        : [];
      const docScope: SQL | undefined = enabled.has("docs")
        ? await visibleDocsCondition(ctx.permissions, "docs.view")
        : undefined;
      const ticketsVisible = await canViewTickets(ctx);

      const taskPredicates = [
        ilike(tasks.name, pattern),
        ilike(tasks.key, pattern),
        ilike(tasks.description ?? "", pattern),
        ...kwPatterns.flatMap((kp) => [
          ilike(tasks.name, kp),
          ilike(tasks.key, kp),
          ilike(tasks.description ?? "", kp),
        ]),
      ];

      const docPredicates = [
        ilike(docs.title, pattern),
        ilike(docs.content ?? "", pattern),
        ...kwPatterns.flatMap((kp) => [
          ilike(docs.title, kp),
          ilike(docs.content ?? "", kp),
        ]),
      ];

      const ticketPredicates = [
        ilike(tickets.subject, pattern),
        ilike(tickets.description ?? "", pattern),
        ...kwPatterns.flatMap((kp) => [
          ilike(tickets.subject, kp),
          ilike(tickets.description ?? "", kp),
        ]),
      ];

      const [taskHits, docHits, ticketHits] = await Promise.all([
        !taskProjects.length
          ? []
          : ctx.db
              .select({
                id: tasks.id,
                key: tasks.key,
                title: tasks.name,
                description: tasks.description,
                status: tasks.status,
                priority: tasks.priority,
              })
              .from(tasks)
              .where(
                and(
                  eq(tasks.organizationId, orgId),
                  inArray(tasks.projectId, taskProjects),
                  isNull(tasks.deletedAt),
                  or(...taskPredicates),
                ),
              )
              .limit(input.limit * 2),

        !docScope
          ? []
          : ctx.db
              .select({
                id: docs.id,
                slug: docs.slug,
                title: docs.title,
                content: docs.content,
              })
              .from(docs)
              .where(
                and(
                  eq(docs.organizationId, orgId),
                  isNull(docs.deletedAt),
                  docScope,
                  or(...docPredicates),
                ),
              )
              .limit(input.limit * 2),

        !ticketsVisible
          ? []
          : ctx.db
              .select({
                id: tickets.id,
                number: tickets.number,
                subject: tickets.subject,
                description: tickets.description,
                status: tickets.status,
                priority: tickets.priority,
              })
              .from(tickets)
              .where(
                and(eq(tickets.organizationId, orgId), or(...ticketPredicates)),
              )
              .limit(input.limit * 2),
      ]);

      // Score and rank results
      const scored = [
        ...taskHits.map((t) => {
          let score = 0;
          const text =
            `${t.key} ${t.title} ${t.description ?? ""}`.toLowerCase();
          for (const kw of keywords) {
            if (t.key.toLowerCase().includes(kw)) score += 5;
            if (t.title.toLowerCase().includes(kw)) score += 3;
            if (text.includes(kw)) score += 1;
          }
          return {
            id: t.id,
            type: "task" as const,
            key: t.key,
            title: t.title,
            snippet: t.description
              ? t.description.slice(0, 140)
              : `Status: ${t.status}`,
            score,
            href: `/tasks/${t.key}`,
          };
        }),
        ...docHits.map((d) => {
          let score = 0;
          const text = `${d.title} ${d.content ?? ""}`.toLowerCase();
          for (const kw of keywords) {
            if (d.title.toLowerCase().includes(kw)) score += 4;
            if (text.includes(kw)) score += 1;
          }
          return {
            id: d.id,
            type: "doc" as const,
            key: d.slug,
            title: d.title,
            snippet: d.content ? d.content.slice(0, 140) : null,
            score,
            href: `/docs/${d.slug}`,
          };
        }),
        ...ticketHits.map((tk) => {
          let score = 0;
          const text =
            `SUP-${tk.number} ${tk.subject} ${tk.description ?? ""}`.toLowerCase();
          for (const kw of keywords) {
            if (`SUP-${tk.number}`.toLowerCase().includes(kw)) score += 5;
            if (tk.subject.toLowerCase().includes(kw)) score += 3;
            if (text.includes(kw)) score += 1;
          }
          return {
            id: tk.id,
            type: "ticket" as const,
            key: `SUP-${tk.number}`,
            title: tk.subject,
            snippet: tk.description
              ? tk.description.slice(0, 140)
              : `Status: ${tk.status}`,
            score,
            href: `/tickets/${tk.id}`,
          };
        }),
      ];

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, input.limit);
    }),

  /**
   * A keyword heuristic, not a model: it reports no confidence, because it
   * has none to report.
   */
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
  triageTicket: permissionProcedure("tickets.view", undefined, {
    module: "tickets",
  })
    .input(
      z.object({
        subject: z.string().min(1).max(500),
        body: z.string().min(1).max(20_000),
      }),
    )
    .query(async ({ input }) => {
      const fullText = `${input.subject} ${input.body}`.toLowerCase();

      // Sentiment detection
      let sentiment: "positive" | "neutral" | "frustrated" = "neutral";
      if (
        fullText.includes("angry") ||
        fullText.includes("broken") ||
        fullText.includes("unacceptable") ||
        fullText.includes("terrible") ||
        fullText.includes("down") ||
        fullText.includes("urgent")
      ) {
        sentiment = "frustrated";
      } else if (
        fullText.includes("thank") ||
        fullText.includes("great") ||
        fullText.includes("appreciate") ||
        fullText.includes("awesome")
      ) {
        sentiment = "positive";
      }

      // Priority assessment
      let priority: "urgent" | "high" | "normal" | "low" = "normal";
      if (
        fullText.includes("security") ||
        fullText.includes("vulnerability") ||
        fullText.includes("outage") ||
        fullText.includes("critical") ||
        fullText.includes("payment failing")
      ) {
        priority = "urgent";
      } else if (
        fullText.includes("bug") ||
        fullText.includes("error") ||
        fullText.includes("fail") ||
        fullText.includes("cannot access")
      ) {
        priority = "high";
      } else if (
        fullText.includes("feature request") ||
        fullText.includes("feedback")
      ) {
        priority = "low";
      }

      // Department routing
      let category: "billing" | "bug" | "feature" | "question" = "question";
      if (
        fullText.includes("invoice") ||
        fullText.includes("card") ||
        fullText.includes("charge") ||
        fullText.includes("billing") ||
        fullText.includes("subscription")
      ) {
        category = "billing";
      } else if (
        fullText.includes("bug") ||
        fullText.includes("broken") ||
        fullText.includes("crash") ||
        fullText.includes("error")
      ) {
        category = "bug";
      } else if (
        fullText.includes("request") ||
        fullText.includes("suggest") ||
        fullText.includes("enhancement")
      ) {
        category = "feature";
      }

      return {
        priority,
        sentiment,
        category,
        autoAssignTag: category,
      };
    }),

  /** Open tickets whose words overlap the given text. */
  detectDuplicateTickets: permissionProcedure("tickets.view", undefined, {
    module: "tickets",
  })
    .input(
      z.object({
        subject: z.string().min(1).max(500),
        description: z.string().max(20_000).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganization.id;
      const inputWords = new Set(
        `${input.subject} ${input.description ?? ""}`
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 3),
      );

      if (inputWords.size === 0) return { duplicates: [] };

      const openTickets = await ctx.db
        .select({
          id: tickets.id,
          number: tickets.number,
          subject: tickets.subject,
          description: tickets.description,
          status: tickets.status,
          createdAt: tickets.createdAt,
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.organizationId, orgId),
            ne(tickets.status, "resolved"),
          ),
        )
        .orderBy(desc(tickets.createdAt))
        .limit(30);

      const duplicates: Array<{
        id: string;
        ref: string;
        subject: string;
        similarity: number;
      }> = [];

      for (const t of openTickets) {
        const ticketWords = new Set(
          `${t.subject} ${t.description ?? ""}`
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((w) => w.length > 3),
        );

        let intersection = 0;
        for (const w of inputWords) {
          if (ticketWords.has(w)) intersection++;
        }

        const union = new Set([...inputWords, ...ticketWords]).size;
        const similarity = union > 0 ? intersection / union : 0;

        if (similarity >= 0.35) {
          duplicates.push({
            id: t.id,
            ref: `SUP-${t.number}`,
            subject: t.subject,
            similarity: Math.round(similarity * 100),
          });
        }
      }

      duplicates.sort((a, b) => b.similarity - a.similarity);
      return { duplicates: duplicates.slice(0, 5) };
    }),

  /** A progress note for a doc, from the tasks linked to it. */
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
});
