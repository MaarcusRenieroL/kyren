import { TRPCError } from "@trpc/server";
import { and, eq, inArray, lte, gte, sql } from "@zentro/db/drizzle";
import { employees, leaveRequests } from "@zentro/db/schema";
import { encryptField } from "@zentro/utils/field-crypto";
import { z } from "zod";

import { currentMemberId } from "../../chat";
import { isoDate, uuid } from "../../zod-common";
import { currentEmployee } from "./employees";
import { annualLeaveBalance } from "./leave-balance";
import { countWeekdays, leaveTypes, procedure } from "./types";

export const hrLeaveMutationsProcedures = {
  leaveRequest: procedure("hr.view", undefined, ["hr.leave.request"])
    .input(
      z
        .object({
          type: z.enum(leaveTypes).default("annual"),
          startDate: isoDate,
          endDate: isoDate,
          note: z.string().trim().max(500).nullable().default(null),
        })
        .refine((value) => value.endDate >= value.startDate, {
          message: "The leave can't end before it starts.",
          path: ["endDate"],
        })
        .refine(
          (value) =>
            +new Date(value.endDate) - +new Date(value.startDate) <=
            366 * 864e5,
          { message: "Leave can span at most a year.", path: ["endDate"] },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await ctx.permissions.can("hr.leave.request"))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can't request leave.",
        });
      }

      const employee = await currentEmployee(ctx);

      if (!employee) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You don't have an employee record yet. Ask HR to add you.",
        });
      }

      const days = countWeekdays(input.startDate, input.endDate);

      if (days === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That range only covers a weekend.",
        });
      }

      return ctx.db.transaction(async (tx) => {
        // One request per person at a time, so the overlap check cannot be
        // raced by a double submit.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`leave:${employee.id}`}, 0))`,
        );

        const [overlap] = await tx
          .select({ id: leaveRequests.id })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.employeeId, employee.id),
              inArray(leaveRequests.status, ["pending", "approved"]),
              lte(leaveRequests.startDate, input.endDate),
              gte(leaveRequests.endDate, input.startDate),
            ),
          )
          .limit(1);

        if (overlap) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You already have leave requested for some of those days.",
          });
        }

        // Annual leave can't go past the year's allowance, when one is set.
        const year = Number(input.startDate.slice(0, 4));
        const balance =
          input.type === "annual"
            ? await annualLeaveBalance(
                tx,
                employee,
                year,
                // Monthly accrual: what is earned by the month the leave starts.
                Number(input.startDate.slice(5, 7)),
              )
            : null;

        if (balance) {
          const left = balance.remaining;

          if (days > left) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                left > 0
                  ? `You have ${left} ${left === 1 ? "day" : "days"} of annual leave left in ${year}.`
                  : `You have no annual leave left in ${year}.`,
            });
          }
        }

        const [row] = await tx
          .insert(leaveRequests)
          .values({
            ...input,
            note: encryptField(input.note),
            days,
            organizationId: ctx.activeOrganization.id,
            employeeId: employee.id,
          })
          .returning({ id: leaveRequests.id });

        return { id: row!.id };
      });
    }),

  leaveCancel: procedure("hr.view")
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const mine = await currentEmployee(ctx);
      const result = mine
        ? await ctx.db
            .update(leaveRequests)
            .set({ status: "cancelled" })
            .where(
              and(
                eq(leaveRequests.id, input.id),
                eq(leaveRequests.employeeId, mine.id),
                eq(leaveRequests.status, "pending"),
              ),
            )
            .returning({ id: leaveRequests.id })
        : [];

      if (!result.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "There's no pending request of yours to cancel.",
        });
      }

      return { id: input.id };
    }),

  leaveDecide: procedure("hr.manage", ["leave.decided"])
    .input(z.object({ id: uuid, decision: z.enum(["approved", "rejected"]) }))
    .mutation(async ({ ctx, input }) => {
      const decider = await currentMemberId(ctx);
      const [row] = await ctx.db
        .select({ request: leaveRequests, name: employees.name })
        .from(leaveRequests)
        .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
        .where(
          and(
            eq(leaveRequests.id, input.id),
            eq(leaveRequests.organizationId, ctx.activeOrganization.id),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found.",
        });
      }

      // Someone else has to decide your own leave.
      const mine = await currentEmployee(ctx);

      if (mine && mine.id === row.request.employeeId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Ask another manager to decide your own leave.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        // The status is part of the filter, so two deciders cannot both win.
        const decided = await tx
          .update(leaveRequests)
          .set({
            status: input.decision,
            decidedByMemberId: decider,
            decidedAt: new Date(),
          })
          .where(
            and(
              eq(leaveRequests.id, row.request.id),
              eq(leaveRequests.status, "pending"),
            ),
          )
          .returning({ id: leaveRequests.id });

        if (!decided.length) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That request has already been decided.",
          });
        }

        await ctx.audit.record(tx, {
          action: "leave.decided",
          target: { id: row.request.id, label: row.name },
          metadata: { decision: input.decision, days: row.request.days },
        });
      });

      return { id: row.request.id };
    }),
};
