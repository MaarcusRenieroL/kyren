import { TRPCError } from "@trpc/server";
import { alias, and, eq } from "@zentro/db/drizzle";
import { employees, members, payslips } from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../../chat";
import { uuid } from "../../zod-common";
import { type OrganizationContext } from "../../trpc";
import { employeeInput, procedure } from "./types";

export const manager = alias(employees, "manager");

export async function findEmployee(ctx: OrganizationContext, id: string) {
  const [employee] = await ctx.db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, id),
        eq(employees.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!employee) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Person not found." });
  }

  return employee;
}

/** Rejects a manager or member link that belongs to another organization. */
export async function assertLinks(
  ctx: OrganizationContext,
  input: { managerId: string | null; memberId: string | null },
  selfId?: string,
) {
  const organizationId = ctx.activeOrganization.id;

  if (input.managerId) {
    if (input.managerId === selfId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Someone can't be their own manager.",
      });
    }

    await findEmployee(ctx, input.managerId);
  }

  if (input.memberId) {
    const [member] = await ctx.db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.id, input.memberId),
          eq(members.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That account isn't in this organization.",
      });
    }

    const [taken] = await ctx.db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.organizationId, organizationId),
          eq(employees.memberId, input.memberId),
        ),
      )
      .limit(1);

    if (taken && taken.id !== selfId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "That account already belongs to another person.",
      });
    }
  }
}

/** The employee record of the caller, when they have one. */
export async function currentEmployee(ctx: OrganizationContext) {
  const memberId = await currentMemberId(ctx);
  const [employee] = await ctx.db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, ctx.activeOrganization.id),
        eq(employees.memberId, memberId),
      ),
    )
    .limit(1);

  return employee ?? null;
}

export const hrEmployeeProcedures = {
  create: procedure("hr.manage", ["employee.added"])
    .input(employeeInput)
    .mutation(async ({ ctx, input }) => {
      await assertLinks(ctx, input);

      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(employees)
          .values({ ...input, organizationId: ctx.activeOrganization.id })
          .returning({ id: employees.id });

        await ctx.audit.record(tx, {
          action: "employee.added",
          target: { id: row!.id, label: input.name },
        });

        return { id: row!.id };
      });
    }),

  update: procedure("hr.manage", ["employee.updated"])
    .input(z.object({ id: uuid, data: employeeInput }))
    .mutation(async ({ ctx, input }) => {
      const employee = await findEmployee(ctx, input.id);
      const linkFrom = employee.memberId ?? null;
      const linkTo = input.data.memberId ?? null;

      // Who a record belongs to decides whose payslips someone sees and who
      // may approve their leave, so nobody re-points a link that involves
      // their own account; another HR manager has to.
      if (linkFrom !== linkTo) {
        const self = await currentMemberId(ctx);

        if (linkFrom === self || linkTo === self) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Another HR manager has to change which account your own record belongs to.",
          });
        }
      }

      await assertLinks(ctx, input.data, employee.id);

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(employees)
          .set({ ...input.data, updatedAt: new Date() })
          .where(eq(employees.id, employee.id));
        await ctx.audit.record(tx, {
          action: "employee.updated",
          target: { id: employee.id, label: input.data.name },
        });
      });

      return { id: employee.id };
    }),

  remove: procedure("hr.manage", ["employee.removed"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const employee = await findEmployee(ctx, input.id);

      await ctx.db.transaction(async (tx) => {
        // Pay history is a record the person and the books still need, so
        // someone who has been paid is marked as former instead.
        const [paid] = await tx
          .select({ id: payslips.id })
          .from(payslips)
          .where(eq(payslips.employeeId, employee.id))
          .limit(1);

        if (paid) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This person has payroll history. Mark them as former instead of deleting them.",
          });
        }

        await tx.delete(employees).where(eq(employees.id, employee.id));
        await ctx.audit.record(tx, {
          action: "employee.removed",
          target: { id: employee.id, label: employee.name },
        });
      });

      return { id: employee.id };
    }),
};
