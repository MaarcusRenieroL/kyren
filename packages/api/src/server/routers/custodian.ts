import { and, count, eq, inArray, isNull, lt, ne } from "@zentro/db/drizzle";
import { docs, tasks, tickets, workLinks } from "@zentro/db/schema";
import { z } from "zod";

import { visibleDocsCondition } from "../access";
import { syncMentions, taskKeysIn } from "../mentions";
import { permissionProcedure, router } from "../trpc";
import { getCurrentMember } from "./task-helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mention links from these docs, so the sweep can report what it added. */
async function mentionLinkCount(
  db: Parameters<typeof syncMentions>[0],
  organizationId: string,
  docIds: string[],
) {
  if (!docIds.length) return 0;

  const [row] = await db
    .select({ n: count() })
    .from(workLinks)
    .where(
      and(
        eq(workLinks.organizationId, organizationId),
        eq(workLinks.sourceType, "doc"),
        inArray(workLinks.sourceId, docIds),
        eq(workLinks.kind, "mentions"),
        eq(workLinks.via, "content"),
      ),
    );

  return row?.n ?? 0;
}

/**
 * A maintenance sweep for organization admins: lists stale tasks and tickets
 * at risk of breaching their SLA, and rebuilds the doc-to-task mention links
 * (the same links a doc save keeps in step) for docs saved before they existed.
 * Everything it reads or reports is limited to what the caller may see.
 */
export const custodianRouter = router({
  runSweep: permissionProcedure("org.settings.update", undefined, {
    also: ["tasks.view", "docs.view", "tickets.view"],
  })
    .input(z.object({ dryRun: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganization.id;
      const enabled = await ctx.enabledModules();
      const now = Date.now();

      const taskProjects = enabled.has("tasks")
        ? await ctx.permissions.viewableProjectIds("tasks.view")
        : [];
      const staleTasks = taskProjects.length
        ? await ctx.db
            .select({ key: tasks.key })
            .from(tasks)
            .where(
              and(
                eq(tasks.organizationId, orgId),
                inArray(tasks.projectId, taskProjects),
                isNull(tasks.deletedAt),
                ne(tasks.status, "done"),
                lt(tasks.updatedAt, new Date(now - 14 * DAY_MS)),
              ),
            )
            .limit(50)
        : [];

      const visibleDocs = enabled.has("docs")
        ? await ctx.db
            .select({ id: docs.id, content: docs.content })
            .from(docs)
            .where(
              and(
                eq(docs.organizationId, orgId),
                isNull(docs.deletedAt),
                await visibleDocsCondition(ctx.permissions, "docs.view"),
              ),
            )
            .limit(200)
        : [];
      const mentioning = visibleDocs.filter(
        (doc) => taskKeysIn(doc.content).length,
      );
      const docIds = mentioning.map((doc) => doc.id);
      const before = await mentionLinkCount(ctx.db, orgId, docIds);
      let linksCreated = 0;

      if (input.dryRun) {
        // A dry run reports how many docs name tasks, without writing.
        linksCreated = mentioning.length;
      } else if (mentioning.length) {
        const member = await getCurrentMember(ctx);

        await ctx.db.transaction(async (tx) => {
          for (const doc of mentioning) {
            await syncMentions(tx, {
              organizationId: orgId,
              memberId: member.id,
              source: { type: "doc", id: doc.id },
              text: doc.content,
              via: "content",
              mode: "replace",
            });
          }
        });

        linksCreated = Math.max(
          0,
          (await mentionLinkCount(ctx.db, orgId, docIds)) - before,
        );
      }

      const ticketsVisible =
        enabled.has("tickets") &&
        (await ctx.permissions.check("tickets.view")).allowed;
      const atRiskTickets = ticketsVisible
        ? await ctx.db
            .select({ number: tickets.number })
            .from(tickets)
            .where(
              and(
                eq(tickets.organizationId, orgId),
                eq(tickets.status, "open"),
                lt(tickets.createdAt, new Date(now - DAY_MS)),
              ),
            )
            .limit(50)
        : [];

      return {
        dryRun: input.dryRun,
        staleTasksCount: staleTasks.length,
        staleTaskKeys: staleTasks.map((t) => t.key),
        linksCreated,
        slaRiskCount: atRiskTickets.length,
        slaRiskTickets: atRiskTickets.map((t) => `SUP-${t.number}`),
        timestamp: new Date(now).toISOString(),
      };
    }),
});
