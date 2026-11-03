import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "@zentro/db/drizzle";
import { taskTemplates } from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../chat";
import { loadProjectById, projectFromInput } from "../resources";
import type { TRPCContext } from "../../types";
import { permissionProcedure, router } from "../trpc";
import { taskRouter } from "./task";

const uuid = z.string().uuid();

const templateInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(120),
  taskDescription: z.string().trim().max(10_000).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  estimatePoints: z.number().int().min(0).max(1000).nullable().optional(),
  dueInDays: z.number().int().min(0).max(365).nullable().optional(),
  subtasks: z.array(z.string().trim().min(1).max(120)).max(20),
});

const manage = (audit: string[]) =>
  permissionProcedure("tasks.manage_templates", undefined, {
    module: "tasks",
    audit,
  });

export const taskTemplateRouter = router({
  /** Everyone who can see tasks can see the templates. */
  list: permissionProcedure("tasks.view", undefined, { module: "tasks" }).query(
    ({ ctx }) =>
      ctx.db
        .select()
        .from(taskTemplates)
        .where(eq(taskTemplates.organizationId, ctx.activeOrganization.id))
        .orderBy(asc(taskTemplates.name)),
  ),

  save: manage(["tasktemplate.saved"])
    .input(templateInput)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;
      const memberId = await currentMemberId(ctx);
      const values = {
        name: input.name,
        taskDescription: input.taskDescription || null,
        priority: input.priority,
        estimatePoints: input.estimatePoints ?? null,
        dueInDays: input.dueInDays ?? null,
        subtasks: input.subtasks,
        updatedAt: new Date(),
      };

      return ctx.db.transaction(async (tx) => {
        const [row] = input.id
          ? await tx
              .update(taskTemplates)
              .set(values)
              .where(
                and(
                  eq(taskTemplates.id, input.id),
                  eq(taskTemplates.organizationId, organizationId),
                ),
              )
              .returning()
          : await tx
              .insert(taskTemplates)
              .values({
                ...values,
                organizationId,
                createdByMemberId: memberId,
              })
              .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "tasktemplate.saved",
          target: { id: row.id, label: row.name },
        });

        return row;
      });
    }),

  remove: manage(["tasktemplate.deleted"])
    .input(z.object({ id: uuid }))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .delete(taskTemplates)
          .where(
            and(
              eq(taskTemplates.id, input.id),
              eq(taskTemplates.organizationId, ctx.activeOrganization.id),
            ),
          )
          .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "tasktemplate.deleted",
          target: { id: row.id, label: row.name },
        });

        return { ok: true };
      }),
    ),

  /**
   * Creates the template's task and its steps in a project. Every task goes
   * through the normal task creation, so keys, permissions and audit entries
   * are the same as when it is made by hand.
   */
  createFrom: permissionProcedure("tasks.create", projectFromInput, {
    module: "tasks",
  })
    .input(
      z.object({
        templateId: uuid,
        projectId: uuid,
        name: z.string().trim().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [template] = await ctx.db
        .select()
        .from(taskTemplates)
        .where(
          and(
            eq(taskTemplates.id, input.templateId),
            eq(taskTemplates.organizationId, ctx.activeOrganization.id),
          ),
        )
        .limit(1);

      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      // A project of another organization reads as missing.
      if (!(await loadProjectById(ctx, input.projectId))) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const tasksApi = taskRouter.createCaller(ctx as unknown as TRPCContext);
      const parent = await tasksApi.createTask({
        projectId: input.projectId,
        name: input.name ?? template.name,
        description: template.taskDescription ?? undefined,
        priority: template.priority as "low" | "medium" | "high",
        estimatePoints: template.estimatePoints ?? undefined,
        dueAt:
          template.dueInDays === null
            ? undefined
            : new Date(Date.now() + template.dueInDays * 86_400_000),
      });
      const keys = [parent.key];

      for (const title of template.subtasks) {
        const child = await tasksApi.createTask({
          projectId: input.projectId,
          name: title,
          parentTaskId: parent.id,
        });

        keys.push(child.key);
      }

      return { keys };
    }),
});
