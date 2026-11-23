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


export const aiTicketsProcedures = {
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
};
