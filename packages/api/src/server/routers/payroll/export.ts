import { TRPCError } from "@trpc/server";
import { buildCsv } from "@zentro/audit";
import { asc, eq } from "@zentro/db/drizzle";
import { payslips } from "@zentro/db/schema";
import { z } from "zod";

import { minorToDecimal } from "../../payroll-math";
import { uuid } from "../../zod-common";
import { findRun, procedure } from "./types";

export const payrollExportProcedures = {
  exportRun: procedure("payroll.view", ["payroll.run_exported"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const run = await findRun(ctx, input.id);

      if (run.status === "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Approve the pay run before exporting it.",
        });
      }

      const lines = await ctx.db
        .select()
        .from(payslips)
        .where(eq(payslips.payRunId, run.id))
        .orderBy(asc(payslips.employeeName));
      const csv = buildCsv(
        [
          "employee_id",
          "employee",
          "currency",
          "base",
          "bonus",
          "deductions",
          "net",
          "pay_date",
          "reference",
        ],
        lines.map((line) => [
          line.employeeId,
          line.employeeName,
          line.currency,
          minorToDecimal(line.base, line.currency),
          minorToDecimal(line.bonus, line.currency),
          minorToDecimal(line.deductions, line.currency),
          minorToDecimal(line.net, line.currency),
          run.periodEnd,
          run.label,
        ]),
      );

      await ctx.db.transaction(async (tx) => {
        await ctx.audit.record(tx, {
          action: "payroll.run_exported",
          target: { id: run.id, label: run.label },
          metadata: { rowCount: lines.length },
        });
      });

      return {
        csv,
        filename: `pay-run-${run.periodEnd}-${run.id.slice(0, 8)}.csv`,
      };
    }),
};
