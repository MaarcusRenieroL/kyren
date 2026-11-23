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
} from "@kyren/db/drizzle";
import { projects, sprints, tasks } from "@kyren/db/schema";
import { z } from "zod";

import { projectFromInput } from "../../resources";
import { permissionProcedure, router, type OrganizationContext } from "../../trpc";
import { isoDate, uuid } from "../../zod-common";
import { recordTaskChanges } from "../task-helpers";
import { safeTimeZone, zonedDay, zonedDayStart } from "../../../time-zone";

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


export const sprintLifecycleProcedures = {
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
};
