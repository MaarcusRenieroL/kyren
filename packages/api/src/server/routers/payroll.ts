import { TRPCError } from "@trpc/server";
import { buildCsv } from "@zentro/audit";
import { and, asc, desc, eq, gte, inArray, or, sql } from "@zentro/db/drizzle";
import {
  compensationChanges,
  compensations,
  employees,
  members,
  payRuns,
  payslips,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../chat";
import { minorToDecimal, proratedBase } from "../payroll-math";
import { isUniqueViolation } from "../db-errors";
import { isoDate, uuid } from "../zod-common";
import { permissionProcedure, router, type OrganizationContext } from "../trpc";
import { currentEmployee } from "./hr";

/** Whole minor units (cents), kept within a Postgres integer. */
const money = z.number().int().min(0).max(2_000_000_000);

const procedure = (permission: string, audit?: string[], also?: string[]) =>
  permissionProcedure(permission, undefined, {
    module: "payroll",
    audit,
    also,
  });

/** Deductions and net pay for one line, in minor units. */
export function computePay(
  base: number,
  bonus: number,
  deductionRateBps: number,
) {
  const gross = base + bonus;
  const deductions = Math.round((gross * deductionRateBps) / 10_000);

  return { deductions, net: gross - deductions };
}

async function findRun(ctx: OrganizationContext, id: string) {
  const [run] = await ctx.db
    .select()
    .from(payRuns)
    .where(
      and(
        eq(payRuns.id, id),
        eq(payRuns.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Pay run not found." });
  }

  return run;
}

function assertStatus(run: { status: string }, expected: string, verb: string) {
  if (run.status !== expected) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Only a ${expected} pay run can be ${verb}.`,
    });
  }
}

/** Moves a run to its next status only if it is still in the expected one. */
async function moveRun(
  tx: Parameters<Parameters<OrganizationContext["db"]["transaction"]>[0]>[0],
  run: { id: string },
  from: string,
  to: Partial<typeof payRuns.$inferInsert>,
  verb: string,
) {
  const moved = await tx
    .update(payRuns)
    .set(to)
    .where(and(eq(payRuns.id, run.id), eq(payRuns.status, from)))
    .returning({ id: payRuns.id });

  if (!moved.length) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Only a ${from} pay run can be ${verb}.`,
    });
  }
}

export const payrollRouter = router({
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

  /** The caller's own payslips, once their run is approved. */
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

  /** Everyone on the payroll with their salary, if set. */
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

  /** A draft run with one line per employee paid in the period, prorated by the day. */
  createRun: procedure("payroll.manage", ["payroll.run_created"])
    .input(
      z
        .object({
          label: z.string().trim().min(1, "Name the pay run.").max(80),
          periodStart: isoDate,
          periodEnd: isoDate,
          deductionRateBps: z.number().int().min(0).max(10_000).default(2000),
          /** Which salaries this run pays, when people are paid in several. */
          currency: z
            .string()
            .trim()
            .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code.")
            .transform((code) => code.toUpperCase())
            .optional(),
        })
        .refine((value) => value.periodEnd >= value.periodStart, {
          message: "The period can't end before it starts.",
          path: ["periodEnd"],
        })
        .refine(
          (value) =>
            +new Date(value.periodEnd) - +new Date(value.periodStart) <=
            366 * 864e5,
          { message: "A pay run covers at most a year.", path: ["periodEnd"] },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const paid = await ctx.db
        .select({
          employeeId: employees.id,
          name: employees.name,
          annualSalary: compensations.annualSalary,
          currency: compensations.currency,
          startDate: employees.startDate,
          endDate: employees.endDate,
        })
        .from(employees)
        .innerJoin(compensations, eq(compensations.employeeId, employees.id))
        .where(
          and(
            eq(employees.organizationId, ctx.activeOrganization.id),
            or(
              inArray(employees.status, ["active", "on_leave", "leaving"]),
              // Someone who left during the period is still owed their
              // final, prorated pay.
              and(
                eq(employees.status, "former"),
                gte(employees.endDate, input.periodStart),
              ),
            ),
          ),
        );

      if (!paid.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Set a salary for at least one active employee first.",
        });
      }

      const lines = paid
        .map((person) => ({
          ...person,
          base: proratedBase(
            person.annualSalary,
            input.periodStart,
            input.periodEnd,
            person.startDate,
            person.endDate,
          ),
        }))
        .filter((person) => person.base > 0);

      // A run's total adds the lines up, which only makes sense in one
      // currency, so each currency is paid in its own run.
      const currencies = [
        ...new Set(lines.map((line) => line.currency)),
      ].sort();
      const currency =
        input.currency ?? (currencies.length === 1 ? currencies[0] : undefined);

      if (!currency) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: lines.length
            ? `People are paid in ${currencies.join(", ")}. Pick one currency for this run.`
            : "Nobody with a salary was employed during that period.",
        });
      }

      const paidLines = lines.filter((line) => line.currency === currency);

      if (!paidLines.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Nobody employed during that period is paid in ${currency}.`,
        });
      }

      return ctx.db
        .transaction(async (tx) => {
          // One run is created at a time, so the overlap check below cannot
          // be raced by a second request for a nearby period.
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${`pay-runs:${ctx.activeOrganization.id}`}, 0))`,
          );

          const [overlap] = await tx
            .select({ id: payRuns.id })
            .from(payRuns)
            .where(
              and(
                eq(payRuns.organizationId, ctx.activeOrganization.id),
                eq(payRuns.currency, currency),
                // Off-cycle payments don't stand in for a period's salaries.
                eq(payRuns.kind, "regular"),
                sql`${payRuns.periodStart} <= ${input.periodEnd}`,
                sql`${payRuns.periodEnd} >= ${input.periodStart}`,
              ),
            )
            .limit(1);

          if (overlap) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `That period overlaps an existing ${currency} pay run.`,
            });
          }

          const [run] = await tx
            .insert(payRuns)
            .values({
              ...input,
              currency,
              organizationId: ctx.activeOrganization.id,
              createdByMemberId: memberId,
            })
            .returning({ id: payRuns.id });

          await tx.insert(payslips).values(
            paidLines.map((person) => {
              const base = person.base;

              return {
                payRunId: run!.id,
                organizationId: ctx.activeOrganization.id,
                employeeId: person.employeeId,
                employeeName: person.name,
                currency: person.currency,
                base,
                bonus: 0,
                ...computePay(base, 0, input.deductionRateBps),
              };
            }),
          );
          await ctx.audit.record(tx, {
            action: "payroll.run_created",
            target: { id: run!.id, label: input.label },
          });

          return { id: run!.id };
        })
        .catch((error: unknown) => {
          if (isUniqueViolation(error)) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "There is already a pay run for that period.",
            });
          }

          throw error;
        });
    }),

  /**
   * An extra run on one pay date for the people picked: a correction, a
   * missed payment or a one-off bonus. It starts at zero; amounts go in as
   * bonuses, and it is approved and paid like any other run.
   */
  createOffCycleRun: procedure("payroll.manage", ["payroll.run_created"])
    .input(
      z.object({
        label: z.string().trim().min(1, "Name the pay run.").max(80),
        payDate: isoDate,
        currency: z
          .string()
          .trim()
          .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code.")
          .transform((code) => code.toUpperCase()),
        deductionRateBps: z.number().int().min(0).max(10_000).default(2000),
        employeeIds: z.array(uuid).min(1, "Pick at least one person.").max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);
      const ids = [...new Set(input.employeeIds)];
      const people = await ctx.db
        .select({ id: employees.id, name: employees.name })
        .from(employees)
        .where(
          and(
            eq(employees.organizationId, ctx.activeOrganization.id),
            inArray(employees.id, ids),
          ),
        );

      if (people.length !== ids.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Everyone in the run must be in this organization's HR.",
        });
      }

      return ctx.db.transaction(async (tx) => {
        // A double submit (retry, second tab) must not make a second run.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`off-cycle:${ctx.activeOrganization.id}`}, 0))`,
        );

        const [twin] = await tx
          .select({ id: payRuns.id })
          .from(payRuns)
          .where(
            and(
              eq(payRuns.organizationId, ctx.activeOrganization.id),
              eq(payRuns.kind, "off_cycle"),
              eq(payRuns.status, "draft"),
              eq(payRuns.periodStart, input.payDate),
              eq(payRuns.currency, input.currency),
              sql`lower(${payRuns.label}) = lower(${input.label})`,
            ),
          )
          .limit(1);

        if (twin) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `There is already a draft off-cycle run called "${input.label}" for that date.`,
          });
        }

        const [run] = await tx
          .insert(payRuns)
          .values({
            label: input.label,
            periodStart: input.payDate,
            periodEnd: input.payDate,
            deductionRateBps: input.deductionRateBps,
            currency: input.currency,
            kind: "off_cycle",
            organizationId: ctx.activeOrganization.id,
            createdByMemberId: memberId,
          })
          .returning({ id: payRuns.id });

        await tx.insert(payslips).values(
          people.map((person) => ({
            payRunId: run!.id,
            organizationId: ctx.activeOrganization.id,
            employeeId: person.id,
            employeeName: person.name,
            currency: input.currency,
            base: 0,
            bonus: 0,
            ...computePay(0, 0, input.deductionRateBps),
          })),
        );
        await ctx.audit.record(tx, {
          action: "payroll.run_created",
          target: { id: run!.id, label: input.label },
          metadata: { kind: "off_cycle" },
        });

        return { id: run!.id };
      });
    }),

  /**
   * The payment register of an approved or paid run as CSV: what each person
   * is paid, for finance to key in or reconcile. It holds no bank details;
   * Zentro does not store any. Every download is recorded.
   */
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
});
