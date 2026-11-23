import { TRPCError } from "@trpc/server";
import { and, eq, or, sql, type SQL } from "@kyren/db/drizzle";
import {
  docs,
  members,
  tasks,
  workLinks,
} from "@kyren/db/schema";
import { z } from "zod";
import { docById, loadProjectById, taskByKey } from "../../resources";
import { denialFor, type OrganizationContext } from "../../trpc";
import { getCurrentMember } from "../task-helpers";
import { loadDoc, loadTask } from "./links-of";
import { type Ref, uuid } from "./types";

export async function resolveTarget(
  ctx: OrganizationContext,
  target: { type: "task"; key: string } | { type: "doc"; id: string },
): Promise<Ref & { label: string }> {
  if (target.type === "task") {
    const task = await loadTask(ctx, target.key);
    const resource = await taskByKey()({ ctx, input: { key: target.key } });

    if (!task || !resource) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
    }

    const decision = await ctx.permissions.check("tasks.view", resource);

    if (!decision.allowed) throw denialFor(decision);

    return { type: "task", id: task.id, label: task.key };
  }

  const doc = await loadDoc(ctx, target.id);
  const resource = await docById()({ ctx, input: { id: target.id } });

  if (!doc || !resource) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Doc not found." });
  }

  const decision = await ctx.permissions.check("docs.view", resource);

  if (!decision.allowed) throw denialFor(decision);

  return { type: "doc", id: doc.id, label: doc.title || "Untitled" };
}

/** Whether following "blocks" links from `start` leads to `goal`. */
export async function blocksReach(
  ctx: OrganizationContext,
  db: Pick<OrganizationContext["db"], "execute">,
  start: Ref,
  goal: Ref,
) {
  const result = (await db.execute(sql`
    with recursive reach(type, id) as (
      select ${start.type}::text, ${start.id}::uuid
      union
      select ${workLinks.targetType}, ${workLinks.targetId}
      from ${workLinks}
      join reach on ${workLinks.sourceType} = reach.type
        and ${workLinks.sourceId} = reach.id
      where ${workLinks.organizationId} = ${ctx.activeOrganization.id}
        and ${workLinks.kind} = 'blocks'
    )
    select 1 from reach where type = ${goal.type} and id = ${goal.id}::uuid
    limit 1
  `)) as unknown as { rows: unknown[] };

  return result.rows.length > 0;
}

export async function insertLink(
  ctx: OrganizationContext,
  from: Ref,
  to: Ref,
  kind: "blocks" | "relates",
  audit: {
    action: "task.linked" | "doc.linked";
    target: { id: string; label: string };
    projectId: string | null;
    teamId: string | null;
    other: string;
  },
) {
  if (from.type === to.type && from.id === to.id) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Something can’t be linked to itself.",
    });
  }

  const loop = () =>
    new TRPCError({
      code: "BAD_REQUEST",
      message: `That would make a loop: ${audit.other} already waits on this.`,
    });

  if (kind === "blocks" && (await blocksReach(ctx, ctx.db, to, from))) {
    throw loop();
  }

  const member = await getCurrentMember(ctx);
  const filters: SQL[] = [
    eq(workLinks.organizationId, ctx.activeOrganization.id),
    eq(workLinks.kind, kind),
  ];
  // "Relates" reads the same both ways, so either direction already counts.
  const pair = (a: Ref, b: Ref) =>
    and(
      eq(workLinks.sourceType, a.type),
      eq(workLinks.sourceId, a.id),
      eq(workLinks.targetType, b.type),
      eq(workLinks.targetId, b.id),
    )!;
  const [existing] = await ctx.db
    .select({ id: workLinks.id })
    .from(workLinks)
    .where(
      and(
        ...filters,
        kind === "relates"
          ? or(pair(from, to), pair(to, from))
          : pair(from, to),
      ),
    )
    .limit(1);

  if (existing) {
    // Already linked: nothing changed, so nothing is recorded.
    ctx.audit.skipped(audit.action);

    return { id: existing.id, created: false };
  }

  return ctx.db.transaction(async (tx) => {
    if (kind === "blocks") {
      // Two opposite links made at once would each pass the check above, so
      // check again while holding the organization's link lock.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`links:${ctx.activeOrganization.id}`}, 0))`,
      );

      if (await blocksReach(ctx, tx, to, from)) throw loop();
    }

    const [row] = await tx
      .insert(workLinks)
      .values({
        organizationId: ctx.activeOrganization.id,
        sourceType: from.type,
        sourceId: from.id,
        targetType: to.type,
        targetId: to.id,
        kind,
        createdByMemberId: member.id,
      })
      .returning({ id: workLinks.id });

    await ctx.audit.record(tx, {
      action: audit.action,
      target: audit.target,
      projectId: audit.projectId,
      teamId: audit.teamId,
      metadata: { kind, with: audit.other },
    });

    return { id: row!.id, created: true };
  });
}

export const taskTarget = z.discriminatedUnion("type", [
  z.object({ type: z.literal("task"), key: z.string().trim().min(1).max(40) }),
  z.object({ type: z.literal("doc"), id: uuid }),
]);

/**
 * Links between tasks and docs: "blocks" and "relates" are made by people,
 * "mentions" by naming a task key in text (see `syncMentions`).
 */
