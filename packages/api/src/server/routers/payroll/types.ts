import { TRPCError } from "@trpc/server";
import { and, eq } from "@zentro/db/drizzle";
import { payRuns } from "@zentro/db/schema";
import { z } from "zod";

import { permissionProcedure, type OrganizationContext } from "../../trpc";

/** Whole minor units (cents), kept within a Postgres integer. */
export const money = z.number().int().min(0).max(2_000_000_000);

export const procedure = (permission: string, audit?: string[], also?: string[]) =>
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

export async function findRun(ctx: OrganizationContext, id: string) {
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

export function assertStatus(run: { status: string }, expected: string, verb: string) {
  if (run.status !== expected) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Only a ${expected} pay run can be ${verb}.`,
    });
  }
}

/** Moves a run to its next status only if it is still in the expected one. */
export async function moveRun(
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
