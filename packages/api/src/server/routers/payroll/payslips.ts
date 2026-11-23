import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "@kyren/db/drizzle";
import { employees, payRuns, payslips } from "@kyren/db/schema";
import { z } from "zod";

import { uuid } from "../../zod-common";
import { currentEmployee } from "../hr";
import { procedure } from "./types";

export const payrollPayslipsProcedures = {
  mine: procedure("payroll.payslips.view").query(async ({ ctx }) => {
    const employee = await currentEmployee(ctx);

    if (!employee) return [];

    const rows = await ctx.db
      .select({ line: payslips, run: payRuns })
      .from(payslips)
      .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
      .where(
        and(
          eq(payslips.employeeId, employee.id),
          inArray(payRuns.status, ["approved", "paid"]),
        ),
      )
      .orderBy(desc(payRuns.periodEnd));

    return rows.map(({ line, run }) => ({
      id: line.id,
      label: run.label,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      status: run.status,
      kind: run.kind,
      currency: line.currency,
      base: line.base,
      bonus: line.bonus,
      deductions: line.deductions,
      net: line.net,
    }));
  }),

  /**
   * One payslip as a document: the caller's own, or anyone's for people who
   * may view payroll. Only from an approved or paid run; a draft can change.
   */
  payslip: procedure("payroll.payslips.view", undefined, ["payroll.view"])
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ line: payslips, run: payRuns, jobTitle: employees.jobTitle })
        .from(payslips)
        .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
        .leftJoin(employees, eq(employees.id, payslips.employeeId))
        .where(
          and(
            eq(payslips.id, input.id),
            eq(payslips.organizationId, ctx.activeOrganization.id),
            inArray(payRuns.status, ["approved", "paid"]),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payslip not found.",
        });
      }

      const mine = (await currentEmployee(ctx))?.id === row.line.employeeId;

      // Someone else's pay is for payroll staff only; say "not found" so the
      // ids of other people's payslips reveal nothing.
      if (!mine && !(await ctx.permissions.can("payroll.view"))) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payslip not found.",
        });
      }

      return {
        id: row.line.id,
        organization: ctx.activeOrganization.name,
        employeeName: row.line.employeeName,
        jobTitle: row.jobTitle ?? null,
        label: row.run.label,
        kind: row.run.kind,
        status: row.run.status,
        periodStart: row.run.periodStart,
        periodEnd: row.run.periodEnd,
        paidAt: row.run.paidAt,
        deductionRateBps: row.run.deductionRateBps,
        currency: row.line.currency,
        base: row.line.base,
        bonus: row.line.bonus,
        gross: row.line.base + row.line.bonus,
        deductions: row.line.deductions,
        net: row.line.net,
      };
    }),
};
