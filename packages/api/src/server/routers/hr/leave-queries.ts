import { and, asc, desc, eq, gte, lte, ne } from "@kyren/db/drizzle";
import { employees, leaveRequests } from "@kyren/db/schema";
import { z } from "zod";

import { isoDate } from "../../zod-common";
import { currentEmployee } from "./employees";
import { annualLeaveBalance, readNote } from "./leave-balance";
import { procedure } from "./types";

export const hrLeaveQueriesProcedures = {
  /**
   * Approved time off in a date range, for the calendar. Everyone who can see
   * the directory sees who is out and when; the kind of leave (it can say
   * "sick") is only for HR managers and the person themself.
   */
  timeOff: procedure("hr.view")
    .input(
      z
        .object({ from: isoDate, to: isoDate })
        .refine((range) => range.from <= range.to, "The range ends first.")
        .refine(
          (range) =>
            Date.parse(range.to) - Date.parse(range.from) <= 93 * 86_400_000,
          "Pick a range of up to 93 days.",
        ),
    )
    .query(async ({ ctx, input }) => {
      const canManage = await ctx.permissions.can("hr.manage");
      const mine = await currentEmployee(ctx);
      const rows = await ctx.db
        .select({
          id: leaveRequests.id,
          employeeId: leaveRequests.employeeId,
          name: employees.name,
          startDate: leaveRequests.startDate,
          endDate: leaveRequests.endDate,
          type: leaveRequests.type,
        })
        .from(leaveRequests)
        .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
        .where(
          and(
            eq(leaveRequests.organizationId, ctx.activeOrganization.id),
            eq(leaveRequests.status, "approved"),
            lte(leaveRequests.startDate, input.to),
            gte(leaveRequests.endDate, input.from),
            // Like the directory: people who have left are for HR managers.
            canManage ? undefined : ne(employees.status, "former"),
          ),
        )
        .orderBy(asc(leaveRequests.startDate))
        .limit(500);

      return rows.map(({ employeeId, type, ...row }) => ({
        ...row,
        type: canManage || employeeId === mine?.id ? type : null,
      }));
    }),

  /** Everyone's requests for HR managers; just the caller's for everyone else. */
  leaveList: procedure("hr.view").query(async ({ ctx }) => {
    const canManage = await ctx.permissions.can("hr.manage");
    const mine = await currentEmployee(ctx);

    if (!canManage && !mine) {
      return { canManage, canRequest: false, balance: null, requests: [] };
    }

    // The caller's own annual leave this year, when an allowance is set.
    const year = new Date().getUTCFullYear();
    const balance = mine
      ? await annualLeaveBalance(
          ctx.db,
          mine,
          year,
          new Date().getUTCMonth() + 1,
        )
      : null;

    const rows = await ctx.db
      .select({ request: leaveRequests, name: employees.name })
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(
        and(
          eq(leaveRequests.organizationId, ctx.activeOrganization.id),
          canManage ? undefined : eq(leaveRequests.employeeId, mine!.id),
        ),
      )
      .orderBy(desc(leaveRequests.createdAt))
      .limit(300);

    return {
      canManage,
      canRequest:
        Boolean(mine) && (await ctx.permissions.can("hr.leave.request")),
      balance,
      requests: rows.map(({ request, name }) => ({
        id: request.id,
        employeeId: request.employeeId,
        employeeName: name,
        type: request.type,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.days,
        note: readNote(request.note),
        status: request.status,
        mine: request.employeeId === mine?.id,
      })),
    };
  }),
};
