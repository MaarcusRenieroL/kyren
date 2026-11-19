import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from "@zentro/db/drizzle";
import { projects, sprints, tasks } from "@zentro/db/schema";
import { z } from "zod";

import { projectFromInput } from "../resources";
import { permissionProcedure, router, type OrganizationContext } from "../trpc";
import { isoDate, uuid } from "../zod-common";
import { recordTaskChanges } from "./task-helpers";
import { safeTimeZone, zonedDay, zonedDayStart } from "../../time-zone";

const MAX_SPRINT_DAYS = 60;
const MAX_SPRINTS = 200;
const MAX_ASSIGN = 200;
const DAY = 86_400_000;

const view = () =>
  permissionProcedure("tasks.view", projectFromInput, { module: "tasks" });
/** Planning, starting and closing a sprint is project management, not task editing. */
const manage = (audit: string[]) =>
  permissionProcedure("projects.update", projectFromInput, {
    module: "tasks",
    audit,
  });
const planTasks = (audit: string[]) =>
  permissionProcedure("tasks.update_any", projectFromInput, {
    module: "tasks",
    audit,
  });

const bad = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });
const projectInput = z.object({ projectId: uuid });

/** The project must belong to the organization; the permission check alone does not prove that. */
async function ownProject(ctx: OrganizationContext, projectId: string) {
  const [project] = await ctx.db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  }
}

async function sprintOf(
  ctx: OrganizationContext,
  projectId: string,
  id: string,
) {
  await ownProject(ctx, projectId);

  const [sprint] = await ctx.db
    .select()
    .from(sprints)
    .where(
      and(
        eq(sprints.id, id),
        eq(sprints.projectId, projectId),
        eq(sprints.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!sprint) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sprint not found." });
  }

  return sprint;
}

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

export const sprintRouter = router({
  list: view()
    .input(projectInput)
    .query(async ({ ctx, input }) => {
      await ownProject(ctx, input.projectId);

      const rows = await ctx.db
        .select({
          id: sprints.id,
          name: sprints.name,
          goal: sprints.goal,
          startsOn: sprints.startsOn,
          endsOn: sprints.endsOn,
          status: sprints.status,
          taskCount: sql<number>`count(${tasks.id})::int`,
          points: sql<number>`coalesce(sum(coalesce(${tasks.estimatePoints}, 0)), 0)::int`,
          donePoints: sql<number>`coalesce(sum(case when ${tasks.status} = 'done' then coalesce(${tasks.estimatePoints}, 0) else 0 end), 0)::int`,
          doneTasks: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'done')::int`,
        })
        .from(sprints)
        .leftJoin(
          tasks,
          and(eq(tasks.sprintId, sprints.id), isNull(tasks.deletedAt)),
        )
        .where(
          and(
            eq(sprints.projectId, input.projectId),
            eq(sprints.organizationId, ctx.activeOrganization.id),
          ),
        )
        .groupBy(sprints.id)
        .orderBy(asc(sprints.startsOn))
        .limit(MAX_SPRINTS);

      return rows;
    }),

  create: manage(["sprint.created"])
    .input(
      projectInput.extend({
        name: z.string().trim().min(1, "Name the sprint.").max(80),
        goal: z.string().trim().max(500).optional(),
        startsOn: isoDate,
        endsOn: isoDate,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ownProject(ctx, input.projectId);

      const days =
        (Date.parse(input.endsOn) - Date.parse(input.startsOn)) / DAY + 1;

      if (days < 1) throw bad("The sprint cannot end before it starts.");
      if (days > MAX_SPRINT_DAYS) {
        throw bad(`A sprint can last up to ${MAX_SPRINT_DAYS} days.`);
      }

      return ctx.db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`sprints:${input.projectId}`}, 0))`,
        );

        const [held] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(sprints)
          .where(eq(sprints.projectId, input.projectId));

        if ((held?.count ?? 0) >= MAX_SPRINTS) {
          throw bad("This project has too many sprints. Remove old ones.");
        }

        const [created] = await tx
          .insert(sprints)
          .values({
            organizationId: ctx.activeOrganization.id,
            projectId: input.projectId,
            name: input.name,
            goal: input.goal || null,
            startsOn: input.startsOn,
            endsOn: input.endsOn,
          })
          .returning({ id: sprints.id });

        await ctx.audit.record(tx, {
          action: "sprint.created",
          target: { id: created!.id, label: input.name },
          projectId: input.projectId,
        });

        return { id: created!.id };
      });
    }),

  start: manage(["sprint.started"])
    .input(projectInput.extend({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await sprintOf(ctx, input.projectId, input.id);

      if (sprint.status !== "planned") {
        throw bad("Only a planned sprint can be started.");
      }

      const [active] = await ctx.db
        .select({ name: sprints.name })
        .from(sprints)
        .where(
          and(
            eq(sprints.projectId, input.projectId),
            eq(sprints.status, "active"),
          ),
        )
        .limit(1);

      if (active) {
        throw bad(`${active.name} is still running. Complete it first.`);
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(sprints)
          .set({ status: "active" })
          .where(eq(sprints.id, sprint.id));
        await ctx.audit.record(tx, {
          action: "sprint.started",
          target: { id: sprint.id, label: sprint.name },
          projectId: input.projectId,
        });
      });

      return { ok: true };
    }),

  complete: manage(["sprint.completed"])
    .input(
      projectInput.extend({
        id: uuid,
        unfinished: z.enum(["backlog", "next"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sprint = await sprintOf(ctx, input.projectId, input.id);

      if (sprint.status !== "active") {
        throw bad("Only a running sprint can be completed.");
      }

      return ctx.db.transaction(async (tx) => {
        let destination: string | null = null;

        if (input.unfinished === "next") {
          const [next] = await tx
            .select({ id: sprints.id })
            .from(sprints)
            .where(
              and(
                eq(sprints.projectId, input.projectId),
                eq(sprints.status, "planned"),
              ),
            )
            .orderBy(asc(sprints.startsOn))
            .limit(1);

          if (!next) {
            throw bad("There is no planned sprint to move unfinished work to.");
          }

          destination = next.id;
        }

        const [totals] = await tx
          .select({
            committed: sql<number>`coalesce(sum(coalesce(${tasks.estimatePoints}, 0)), 0)::int`,
            completed: sql<number>`coalesce(sum(case when ${tasks.status} = 'done' then coalesce(${tasks.estimatePoints}, 0) else 0 end), 0)::int`,
          })
          .from(tasks)
          .where(and(eq(tasks.sprintId, sprint.id), isNull(tasks.deletedAt)));

        await tx
          .update(tasks)
          .set({ sprintId: destination })
          .where(and(eq(tasks.sprintId, sprint.id), ne(tasks.status, "done")));
        await tx
          .update(sprints)
          .set({
            status: "completed",
            completedAt: new Date(),
            committedPoints: totals?.committed ?? 0,
            completedPoints: totals?.completed ?? 0,
          })
          .where(eq(sprints.id, sprint.id));
        await ctx.audit.record(tx, {
          action: "sprint.completed",
          target: { id: sprint.id, label: sprint.name },
          projectId: input.projectId,
        });

        return { ok: true };
      });
    }),

  /** Puts tasks into a sprint, or takes them out when `sprintId` is null. */
  assign: planTasks(["task.updated"])
    .input(
      projectInput.extend({
        sprintId: uuid.nullable(),
        keys: z.array(z.string().trim().min(1).max(40)).min(1).max(MAX_ASSIGN),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ownProject(ctx, input.projectId);

      const target = input.sprintId
        ? await sprintOf(ctx, input.projectId, input.sprintId)
        : null;

      if (target?.status === "completed") {
        throw bad("That sprint is already completed.");
      }

      return ctx.db.transaction(async (tx) => {
        const found = await tx
          .select({
            id: tasks.id,
            key: tasks.key,
            name: tasks.name,
            projectId: tasks.projectId,
            teamId: tasks.teamId,
            sprintId: tasks.sprintId,
            sprintName: sprints.name,
          })
          .from(tasks)
          .leftJoin(sprints, eq(sprints.id, tasks.sprintId))
          .where(
            and(
              inArray(tasks.key, [...new Set(input.keys)]),
              eq(tasks.projectId, input.projectId),
              eq(tasks.organizationId, ctx.activeOrganization.id),
              isNull(tasks.deletedAt),
            ),
          )
          .for("update", { of: tasks });

        if (found.length !== new Set(input.keys).size) {
          throw bad("Some of those tasks are not in this project.");
        }

        const changing = found.filter((t) => t.sprintId !== input.sprintId);

        if (!changing.length) {
          ctx.audit.skipped("task.updated");

          return { moved: 0 };
        }

        await tx
          .update(tasks)
          .set({ sprintId: input.sprintId, updatedAt: new Date() })
          .where(
            inArray(
              tasks.id,
              changing.map((t) => t.id),
            ),
          );

        for (const task of changing) {
          await recordTaskChanges(ctx, tx, task, [
            {
              field: "sprint",
              fromValue: task.sprintName,
              toValue: target?.name ?? null,
            },
          ]);
        }

        return { moved: changing.length };
      });
    }),

  /** Work left per day against a straight line to zero. */
  burndown: view()
    .input(
      projectInput.extend({
        id: uuid,
        /** The viewer's IANA zone; each day ends at their midnight. UTC when missing. */
        timeZone: z.string().max(64).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const sprint = await sprintOf(ctx, input.projectId, input.id);
      const zone = safeTimeZone(input.timeZone);
      const rows = await ctx.db
        .select({
          points: tasks.estimatePoints,
          completedAt: tasks.completedAt,
          status: tasks.status,
        })
        .from(tasks)
        .where(and(eq(tasks.sprintId, sprint.id), isNull(tasks.deletedAt)));
      const unit = rows.some((r) => (r.points ?? 0) > 0) ? "points" : "tasks";
      const weight = (r: (typeof rows)[number]) =>
        unit === "points" ? (r.points ?? 0) : 1;
      const total = rows.reduce((sum, r) => sum + weight(r), 0);
      const length =
        (Date.parse(sprint.endsOn) - Date.parse(sprint.startsOn)) / DAY + 1;
      const lastDay = Math.min(
        length,
        Math.max(
          1,
          Math.floor(
            (Date.parse(zonedDay(new Date(), zone)) -
              Date.parse(sprint.startsOn)) /
              DAY,
          ) + 1,
        ),
      );
      const days = Array.from({ length: lastDay }, (_, i) => {
        const day = utcDay(new Date(Date.parse(sprint.startsOn) + i * DAY));
        const cutoff = zonedDayStart(
          utcDay(new Date(Date.parse(sprint.startsOn) + (i + 1) * DAY)),
          zone,
        ).getTime();
        const done = rows
          .filter(
            (r) =>
              r.status === "done" &&
              r.completedAt &&
              r.completedAt.getTime() < cutoff,
          )
          .reduce((sum, r) => sum + weight(r), 0);
        const ideal = length > 1 ? total * (1 - i / (length - 1)) : total;

        return {
          day,
          remaining: total - done,
          ideal: Math.round(ideal * 10) / 10,
        };
      });

      return { unit, total, length, days };
    }),

  /** Points committed and finished in the last completed sprints, oldest first. */
  velocity: view()
    .input(projectInput)
    .query(async ({ ctx, input }) => {
      await ownProject(ctx, input.projectId);

      const rows = await ctx.db
        .select({
          name: sprints.name,
          committedPoints: sprints.committedPoints,
          completedPoints: sprints.completedPoints,
        })
        .from(sprints)
        .where(
          and(
            eq(sprints.projectId, input.projectId),
            eq(sprints.organizationId, ctx.activeOrganization.id),
            eq(sprints.status, "completed"),
          ),
        )
        .orderBy(desc(sprints.completedAt))
        .limit(8);

      return rows.reverse().map((r) => ({
        name: r.name,
        committedPoints: r.committedPoints ?? 0,
        completedPoints: r.completedPoints ?? 0,
      }));
    }),
});
