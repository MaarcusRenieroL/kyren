import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "@zentro/db/drizzle";
import {
  compensationChanges,
  compensations,
  employees,
  members,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../../chat";
import { uuid } from "../../zod-common";
import { money, procedure } from "./types";

export const payrollSalariesProcedures = {
  salaries: procedure("payroll.view").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: employees.id,
        name: employees.name,
        jobTitle: employees.jobTitle,
        status: employees.status,
        annualSalary: compensations.annualSalary,
        currency: compensations.currency,
      })
      .from(employees)
      .leftJoin(compensations, eq(compensations.employeeId, employees.id))
      .where(eq(employees.organizationId, ctx.activeOrganization.id))
      .orderBy(asc(employees.name));

    return {
      canManage: await ctx.permissions.can("payroll.manage"),
      people: rows,
    };
  }),

  setSalary: procedure("payroll.manage", ["payroll.salary_set"])
    .input(
      z.object({
        employeeId: uuid,
        annualSalary: money,
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code.")
          .default("USD"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [employee] = await ctx.db
        .select({ id: employees.id, name: employees.name })
        .from(employees)
        .where(
          and(
            eq(employees.id, input.employeeId),
            eq(employees.organizationId, ctx.activeOrganization.id),
          ),
        )
        .limit(1);

      if (!employee) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found.",
        });
      }

      const memberId = await currentMemberId(ctx);

      await ctx.db.transaction(async (tx) => {
        // One save per person at a time, even before they have a salary row
        // to lock, so the history never gets two entries for one change.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`salary:${employee.id}`}, 0))`,
        );

        const [before] = await tx
          .select({
            annualSalary: compensations.annualSalary,
            currency: compensations.currency,
          })
          .from(compensations)
          .where(eq(compensations.employeeId, employee.id))
          .for("update")
          .limit(1);

        await tx
          .insert(compensations)
          .values({
            organizationId: ctx.activeOrganization.id,
            employeeId: employee.id,
            annualSalary: input.annualSalary,
            currency: input.currency,
          })
          .onConflictDoUpdate({
            target: compensations.employeeId,
            set: {
              annualSalary: input.annualSalary,
              currency: input.currency,
              updatedAt: new Date(),
            },
          });
        // Every change is kept, so past pay can always be looked up.
        if (
          before?.annualSalary !== input.annualSalary ||
          before?.currency !== input.currency
        ) {
          await tx.insert(compensationChanges).values({
            organizationId: ctx.activeOrganization.id,
            employeeId: employee.id,
            annualSalary: input.annualSalary,
            currency: input.currency,
            changedByMemberId: memberId,
          });
        }

        // The amount is deliberately left out of the audit log.
        await ctx.audit.record(tx, {
          action: "payroll.salary_set",
          target: { id: employee.id, label: employee.name },
        });
      });

      return { id: employee.id };
    }),

  /** One person's salaries over time, newest first, and who set each. */
  salaryHistory: procedure("payroll.view")
    .input(z.object({ employeeId: uuid }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: compensationChanges.id,
          annualSalary: compensationChanges.annualSalary,
          currency: compensationChanges.currency,
          at: compensationChanges.createdAt,
          changedBy: users.name,
        })
        .from(compensationChanges)
        .leftJoin(
          members,
          eq(members.id, compensationChanges.changedByMemberId),
        )
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(compensationChanges.organizationId, ctx.activeOrganization.id),
            eq(compensationChanges.employeeId, input.employeeId),
          ),
        )
        .orderBy(desc(compensationChanges.createdAt))
        .limit(100);

      return rows.map((row) => ({
        id: row.id,
        annualSalary: row.annualSalary,
        currency: row.currency,
        at: row.at.toISOString(),
        changedBy: row.changedBy ?? null,
      }));
    }),
};
