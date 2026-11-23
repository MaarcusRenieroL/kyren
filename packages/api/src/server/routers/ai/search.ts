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

export const aiSearchProcedures = {
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
};
