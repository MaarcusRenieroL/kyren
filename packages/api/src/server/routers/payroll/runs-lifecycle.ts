import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "@kyren/db/drizzle";
import { payRuns, payslips } from "@kyren/db/schema";
import { z } from "zod";

import { currentMemberId } from "../../chat";
import { uuid } from "../../zod-common";
import {
  assertStatus,
  computePay,
  findRun,
  money,
  moveRun,
  procedure,
} from "./types";

export const payrollRunsLifecycleProcedures = {
  /** Every pay run with its headcount and totals. */
  runs: procedure("payroll.view").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        run: payRuns,
        people: sql<number>`count(${payslips.id})::int`,
        net: sql<number>`coalesce(sum(${payslips.net}), 0)::bigint`.mapWith(
          Number,
        ),
      })
      .from(payRuns)
      .leftJoin(payslips, eq(payslips.payRunId, payRuns.id))
      .where(eq(payRuns.organizationId, ctx.activeOrganization.id))
      .groupBy(payRuns.id)
      .orderBy(desc(payRuns.periodEnd), desc(payRuns.createdAt));

    return {
      canManage: await ctx.permissions.can("payroll.manage"),
      runs: rows.map(({ run, people, net }) => ({
        id: run.id,
        label: run.label,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        status: run.status,
        kind: run.kind,
        currency: run.currency,
        people,
        net,
      })),
    };
  }),

  run: procedure("payroll.view")
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      const run = await findRun(ctx, input.id);
      const lines = await ctx.db
        .select()
        .from(payslips)
        .where(eq(payslips.payRunId, run.id))
        .orderBy(asc(payslips.employeeName));
      const memberId = await currentMemberId(ctx);

      return {
        id: run.id,
        label: run.label,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        deductionRateBps: run.deductionRateBps,
        status: run.status,
        kind: run.kind,
        approvedAt: run.approvedAt?.toISOString() ?? null,
        paidAt: run.paidAt?.toISOString() ?? null,
        canManage: await ctx.permissions.can("payroll.manage"),
        canApprove: await ctx.permissions.can("payroll.approve"),
        /** The two-person rule: whoever made or changed the run can't approve it. */
        approvalNeedsSomeoneElse:
          run.createdByMemberId === memberId ||
          lines.some((line) => line.bonusSetByMemberId === memberId),
        lines: lines.map((line) => ({
          id: line.id,
          employeeName: line.employeeName,
          currency: line.currency,
          base: line.base,
          bonus: line.bonus,
          deductions: line.deductions,
          net: line.net,
        })),
      };
    }),

  setBonus: procedure("payroll.manage", ["payroll.bonus_set"])
    .input(z.object({ payslipId: uuid, bonus: money.max(1_000_000_000) }))
    .mutation(async ({ ctx, input }) => {
      const editor = await currentMemberId(ctx);
      const [row] = await ctx.db
        .select({ line: payslips, run: payRuns })
        .from(payslips)
        .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
        .where(
          and(
            eq(payslips.id, input.payslipId),
            eq(payslips.organizationId, ctx.activeOrganization.id),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payslip not found.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        // Lock the run so an approval cannot slip in between check and write.
        const [locked] = await tx
          .select({ status: payRuns.status })
          .from(payRuns)
          .where(eq(payRuns.id, row.run.id))
          .for("update");

        assertStatus({ status: locked?.status ?? "" }, "draft", "edited");

        await tx
          .update(payslips)
          .set({
            bonus: input.bonus,
            bonusSetByMemberId: editor,
            ...computePay(row.line.base, input.bonus, row.run.deductionRateBps),
          })
          .where(eq(payslips.id, row.line.id));
        await ctx.audit.record(tx, {
          action: "payroll.bonus_set",
          target: { id: row.run.id, label: row.run.label },
        });
      });

      return { id: row.line.id };
    }),

  approveRun: procedure("payroll.approve", ["payroll.run_approved"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const run = await findRun(ctx, input.id);

      assertStatus(run, "draft", "approved");

      // Two people sign off on money: whoever made the run cannot approve it.
      const memberId = await currentMemberId(ctx);

      // Nor can anyone who set a bonus on it.
      const [edited] = await ctx.db
        .select({ id: payslips.id })
        .from(payslips)
        .where(
          and(
            eq(payslips.payRunId, run.id),
            eq(payslips.bonusSetByMemberId, memberId),
          ),
        )
        .limit(1);

      if (run.createdByMemberId === memberId || edited) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Someone who did not create or change this pay run has to approve it.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await moveRun(
          tx,
          run,
          "draft",
          {
            status: "approved",
            approvedAt: new Date(),
            approvedByMemberId: memberId,
          },
          "approved",
        );
        await ctx.audit.record(tx, {
          action: "payroll.run_approved",
          target: { id: run.id, label: run.label },
        });
      });

      return { id: run.id };
    }),

  markPaid: procedure("payroll.approve", ["payroll.run_paid"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const run = await findRun(ctx, input.id);

      assertStatus(run, "approved", "marked as paid");

      await ctx.db.transaction(async (tx) => {
        await moveRun(
          tx,
          run,
          "approved",
          { status: "paid", paidAt: new Date() },
          "marked as paid",
        );
        await ctx.audit.record(tx, {
          action: "payroll.run_paid",
          target: { id: run.id, label: run.label },
        });
      });

      return { id: run.id };
    }),

  deleteRun: procedure("payroll.manage", ["payroll.run_deleted"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const run = await findRun(ctx, input.id);

      assertStatus(run, "draft", "deleted");

      await ctx.db.transaction(async (tx) => {
        const removed = await tx
          .delete(payRuns)
          .where(and(eq(payRuns.id, run.id), eq(payRuns.status, "draft")))
          .returning({ id: payRuns.id });

        if (!removed.length) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Only a draft pay run can be deleted.",
          });
        }

        await ctx.audit.record(tx, {
          action: "payroll.run_deleted",
          target: { id: run.id, label: run.label },
        });
      });

      return { id: run.id };
    }),
};
