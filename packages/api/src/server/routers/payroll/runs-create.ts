import { TRPCError } from "@trpc/server";
import { and, eq, gte, inArray, or, sql } from "@kyren/db/drizzle";
import {
  compensations,
  employees,
  payRuns,
  payslips,
} from "@kyren/db/schema";
import { z } from "zod";

import { currentMemberId } from "../../chat";
import { isUniqueViolation } from "../../db-errors";
import { proratedBase } from "../../payroll-math";
import { isoDate, uuid } from "../../zod-common";
import { computePay, procedure } from "./types";

export const payrollRunsCreateProcedures = {
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
};
