import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, sql } from "@kyren/db/drizzle";
import { customFields, customFieldValues, tasks } from "@kyren/db/schema";
import { z } from "zod";

import { taskByKey } from "../resources";
import { permissionProcedure, router } from "../trpc";
import { isoDate, uuid } from "../zod-common";
import { recordTaskChanges } from "./task-helpers";

const fieldTypes = ["text", "number", "date", "select"] as const;

const admin = (audit?: string[]) =>
  permissionProcedure("admin.manage_custom_fields", undefined, {
    module: "admin",
    audit,
  });

const bad = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });

/** Throws unless the value fits the field's type. */
function checkValue(
  field: { name: string; type: string; options: string[] },
  value: string,
) {
  switch (field.type) {
    case "number":
      if (!/^-?\d{1,15}(\.\d{1,6})?$/.test(value)) {
        throw bad(`${field.name} must be a number.`);
      }

      return;
    case "date":
      if (!isoDate.safeParse(value).success) {
        throw bad(`${field.name} must be a real date.`);
      }

      return;
    case "select":
      if (!field.options.includes(value)) {
        throw bad(`Pick one of the choices for ${field.name}.`);
      }

      return;
    default:
      if (!value.trim()) throw bad(`Write something for ${field.name}.`);
  }
}

export const customFieldRouter = router({
  /** The fields tasks carry, in the order they were arranged. */
  list: permissionProcedure("tasks.view", undefined, {
    module: "tasks",
  }).query(({ ctx }) =>
    ctx.db
      .select({
        id: customFields.id,
        name: customFields.name,
        type: customFields.type,
        options: customFields.options,
      })
      .from(customFields)
      .where(eq(customFields.organizationId, ctx.activeOrganization.id))
      .orderBy(asc(customFields.position), asc(customFields.createdAt)),
  ),

  create: admin(["customfield.created"])
    .input(
      z
        .object({
          name: z.string().trim().min(1, "Name the field.").max(60),
          type: z.enum(fieldTypes),
          options: z
            .array(z.string().trim().min(1).max(60))
            .max(30)
            .default([]),
        })
        .refine(
          (input) => input.type !== "select" || input.options.length > 0,
          {
            message: "Give a select field at least one choice.",
            path: ["options"],
          },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const options =
        input.type === "select" ? [...new Set(input.options)] : [];

      return ctx.db.transaction(async (tx) => {
        const [last] = await tx
          .select({
            max: sql<number>`coalesce(max(${customFields.position}), 0)`,
          })
          .from(customFields)
          .where(eq(customFields.organizationId, ctx.activeOrganization.id));
        // A duplicate name is a unique violation, which the API maps to CONFLICT.
        const [created] = await tx
          .insert(customFields)
          .values({
            organizationId: ctx.activeOrganization.id,
            name: input.name,
            type: input.type,
            options,
            position: (last?.max ?? 0) + 1,
          })
          .returning({ id: customFields.id });

        await ctx.audit.record(tx, {
          action: "customfield.created",
          target: { id: created!.id, label: input.name },
        });

        return { id: created!.id };
      });
    }),

  /** Removes the field and every task's value for it. */
  remove: admin(["customfield.deleted"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [removed] = await tx
          .delete(customFields)
          .where(
            and(
              eq(customFields.id, input.id),
              eq(customFields.organizationId, ctx.activeOrganization.id),
            ),
          )
          .returning({ id: customFields.id, name: customFields.name });

        if (!removed) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Field not found.",
          });
        }

        await ctx.audit.record(tx, {
          action: "customfield.deleted",
          target: { id: removed.id, label: removed.name },
        });
      });

      return { id: input.id };
    }),

  /** Every field with this task's value, or null where none is set. */
  valuesForTask: permissionProcedure("tasks.view", taskByKey("key"), {
    module: "tasks",
  })
    .input(z.object({ key: z.string().trim().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.key, input.key),
            eq(tasks.organizationId, ctx.activeOrganization.id),
            isNull(tasks.deletedAt),
          ),
        )
        .limit(1);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
      }

      return ctx.db
        .select({
          fieldId: customFields.id,
          name: customFields.name,
          type: customFields.type,
          options: customFields.options,
          value: customFieldValues.value,
        })
        .from(customFields)
        .leftJoin(
          customFieldValues,
          and(
            eq(customFieldValues.fieldId, customFields.id),
            eq(customFieldValues.taskId, task.id),
          ),
        )
        .where(eq(customFields.organizationId, ctx.activeOrganization.id))
        .orderBy(asc(customFields.position), asc(customFields.createdAt));
    }),

  /** Sets a task's value for a field, or clears it with null. */
  setValue: permissionProcedure("tasks.update_own", taskByKey("key"), {
    module: "tasks",
    audit: ["task.updated"],
  })
    .input(
      z.object({
        key: z.string().trim().min(1).max(40),
        fieldId: uuid,
        value: z.string().max(1000).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [task] = await tx
          .select({
            id: tasks.id,
            key: tasks.key,
            name: tasks.name,
            projectId: tasks.projectId,
            teamId: tasks.teamId,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.key, input.key),
              eq(tasks.organizationId, ctx.activeOrganization.id),
              isNull(tasks.deletedAt),
            ),
          )
          .limit(1);
        const [field] = await tx
          .select()
          .from(customFields)
          .where(
            and(
              eq(customFields.id, input.fieldId),
              eq(customFields.organizationId, ctx.activeOrganization.id),
            ),
          )
          .limit(1);

        if (!task || !field) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task or field not found.",
          });
        }

        const [before] = await tx
          .select({ value: customFieldValues.value })
          .from(customFieldValues)
          .where(
            and(
              eq(customFieldValues.taskId, task.id),
              eq(customFieldValues.fieldId, field.id),
            ),
          )
          .for("update");

        if (input.value === null) {
          await tx
            .delete(customFieldValues)
            .where(
              and(
                eq(customFieldValues.taskId, task.id),
                eq(customFieldValues.fieldId, field.id),
              ),
            );
        } else {
          checkValue(field, input.value);
          await tx
            .insert(customFieldValues)
            .values({
              taskId: task.id,
              fieldId: field.id,
              value: input.value,
            })
            .onConflictDoUpdate({
              target: [customFieldValues.taskId, customFieldValues.fieldId],
              set: { value: input.value, updatedAt: new Date() },
            });
        }

        if ((before?.value ?? null) !== input.value) {
          await recordTaskChanges(ctx, tx, task, [
            {
              field: field.name,
              fromValue: before?.value ?? null,
              toValue: input.value,
            },
          ]);
        } else {
          ctx.audit.skipped("task.updated");
        }

        return { ok: true };
      });
    }),
});
