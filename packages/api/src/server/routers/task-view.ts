import { TRPCError } from "@trpc/server";
import { and, asc, eq, or, sql } from "@kyren/db/drizzle";
import { taskViews } from "@kyren/db/schema";
import { z } from "zod";

import { permissionProcedure, router } from "../trpc";
import { uuid } from "../zod-common";

const MAX_VIEWS = 50;

const procedure = () =>
  permissionProcedure("tasks.view", undefined, { module: "tasks" });

/** Only values the task list itself can produce; anything else is refused. */
const configSchema = z.object({
  search: z.string().trim().max(100),
  status: z.enum(["all", "backlog", "todo", "in-progress", "review", "done"]),
  priority: z.enum(["all", "low", "medium", "high"]),
  assignee: z.string().trim().min(1).max(120),
  team: z.string().trim().min(1).max(64),
  group: z.enum(["state", "priority", "project", "assignee", "none"]),
  sort: z.enum(["due", "priority", "key", "title"]),
  view: z.enum(["list", "board", "calendar"]),
});

export const taskViewRouter = router({
  /** The person's own views and everything shared with the organization. */
  list: procedure().query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(taskViews)
      .where(
        and(
          eq(taskViews.organizationId, ctx.activeOrganization.id),
          or(
            eq(taskViews.ownerUserId, ctx.user.id),
            eq(taskViews.shared, true),
          ),
        ),
      )
      .orderBy(asc(taskViews.name));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      shared: row.shared,
      mine: row.ownerUserId === ctx.user.id,
      config: row.config,
    }));
  }),

  create: procedure()
    .input(
      z.object({
        name: z.string().trim().min(1, "Name the view.").max(60),
        shared: z.boolean().default(false),
        config: configSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        // One person saving two at once cannot slip past the cap.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`taskview:${ctx.user.id}`}, 0))`,
        );

        const [held] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(taskViews)
          .where(
            and(
              eq(taskViews.organizationId, ctx.activeOrganization.id),
              eq(taskViews.ownerUserId, ctx.user.id),
            ),
          );

        if ((held?.count ?? 0) >= MAX_VIEWS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `You can keep up to ${MAX_VIEWS} views. Remove one first.`,
          });
        }

        // A repeated name is a unique violation, which the API maps to CONFLICT.
        const [created] = await tx
          .insert(taskViews)
          .values({
            organizationId: ctx.activeOrganization.id,
            ownerUserId: ctx.user.id,
            name: input.name,
            shared: input.shared,
            config: input.config,
          })
          .returning({ id: taskViews.id });

        return { id: created!.id };
      });
    }),

  /** Only the person who saved a view can remove it. */
  remove: procedure()
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const removed = await ctx.db
        .delete(taskViews)
        .where(
          and(
            eq(taskViews.id, input.id),
            eq(taskViews.organizationId, ctx.activeOrganization.id),
            eq(taskViews.ownerUserId, ctx.user.id),
          ),
        )
        .returning({ id: taskViews.id });

      if (!removed.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "View not found." });
      }

      return { id: input.id };
    }),
});
