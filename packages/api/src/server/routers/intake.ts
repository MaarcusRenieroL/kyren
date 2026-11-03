import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "@zentro/db/drizzle";
import { intakeForms, type IntakeField } from "@zentro/db/schema";
import { z } from "zod";

import { permissionProcedure, router } from "../trpc";

const procedure = (audit?: string[]) =>
  permissionProcedure("tickets.manage_forms", undefined, {
    module: "tickets",
    audit,
  });

const fieldSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    type: z.enum(["name", "email", "text", "longtext", "choice"]),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  })
  .refine(
    (field) => field.type !== "choice" || (field.options?.length ?? 0) >= 2,
    {
      message: "A choice needs at least two options.",
    },
  );

const formInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  enabled: z.boolean(),
  fields: z.array(fieldSchema).min(1).max(20),
});

export const intakeRouter = router({
  list: procedure().query(({ ctx }) =>
    ctx.db
      .select()
      .from(intakeForms)
      .where(eq(intakeForms.organizationId, ctx.activeOrganization.id))
      .orderBy(asc(intakeForms.createdAt)),
  ),

  save: procedure(["intakeform.saved"])
    .input(formInput)
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const organizationId = ctx.activeOrganization.id;
        const fields: IntakeField[] = input.fields.map((field, index) => ({
          id: `f${index + 1}`,
          label: field.label,
          type: field.type,
          required: field.required,
          ...(field.type === "choice" ? { options: field.options } : {}),
        }));
        const values = {
          name: input.name,
          description: input.description,
          enabled: input.enabled,
          fields,
          updatedAt: new Date(),
        };

        const [row] = input.id
          ? await tx
              .update(intakeForms)
              .set(values)
              .where(
                and(
                  eq(intakeForms.id, input.id),
                  eq(intakeForms.organizationId, organizationId),
                ),
              )
              .returning()
          : await tx
              .insert(intakeForms)
              .values({ ...values, organizationId })
              .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "intakeform.saved",
          target: { id: row.id, label: row.name },
        });

        return row;
      }),
    ),

  remove: procedure(["intakeform.deleted"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .delete(intakeForms)
          .where(
            and(
              eq(intakeForms.id, input.id),
              eq(intakeForms.organizationId, ctx.activeOrganization.id),
            ),
          )
          .returning();

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        await ctx.audit.record(tx, {
          action: "intakeform.deleted",
          target: { id: row.id, label: row.name },
        });

        return { ok: true };
      }),
    ),
});
