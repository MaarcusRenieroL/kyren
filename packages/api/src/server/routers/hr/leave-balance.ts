import { and, eq, gte, inArray, lte, sql } from "@kyren/db/drizzle";
import { leaveRequests } from "@kyren/db/schema";
import { decryptField } from "@kyren/utils/field-crypto";

import { type OrganizationContext } from "../../trpc";

/**
 * Annual leave someone has used this calendar year, counting what is still
 * waiting for a decision so two requests can't both spend the same days.
 * A request counts in the year it starts.
 */
export async function annualLeaveUsed(
  db: Pick<OrganizationContext["db"], "select">,
  employeeId: string,
  year: number,
) {
  const [row] = await db
    .select({
      used: sql<number>`coalesce(sum(${leaveRequests.days}), 0)::float`,
    })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.type, "annual"),
        inArray(leaveRequests.status, ["pending", "approved"]),
        gte(leaveRequests.startDate, `${year}-01-01`),
        lte(leaveRequests.startDate, `${year}-12-31`),
      ),
    );

  return row?.used ?? 0;
}

/**
 * Annual leave earned in `year` by the end of `month`: all of it on
 * 1 January, or with monthly accrual a twelfth for each month worked so far
 * (from the start month in the year someone joins), rounded down to a half day.
 */
export function earnedBy(
  employee: { annualLeaveAccrual: string; startDate: string | null },
  allowance: number,
  year: number,
  month: number,
) {
  if (employee.annualLeaveAccrual !== "monthly") return allowance;

  const start = employee.startDate;
  const firstMonth =
    start && start.startsWith(`${year}-`) ? Number(start.slice(5, 7)) : 1;

  if (start && start > `${year}-12-31`) return 0;

  const months = Math.max(0, month - firstMonth + 1);

  return Math.floor(((allowance * months) / 12) * 2) / 2;
}

/**
 * Someone's annual leave for a year: the allowance, plus what they left
 * unused last year up to their carry-over limit (carried days last one year
 * and never pile up), less what they have used or asked for. Null when no
 * allowance is kept.
 */
export async function annualLeaveBalance(
  db: Pick<OrganizationContext["db"], "select">,
  employee: {
    id: string;
    annualLeaveDays: number | null;
    annualLeaveCarryOverDays: number | null;
    annualLeaveAccrual: string;
    startDate: string | null;
  },
  year: number,
  /** The month (1–12) the balance is for; monthly accrual counts up to it. */
  month = 12,
) {
  if (employee.annualLeaveDays === null) return null;

  const allowance = employee.annualLeaveDays;
  const cap = employee.annualLeaveCarryOverDays ?? 0;
  // Nothing to carry from a year they had not started yet.
  const workedLastYear =
    !employee.startDate || employee.startDate < `${year}-01-01`;
  const carried =
    cap > 0 && workedLastYear
      ? Math.min(
          cap,
          Math.max(
            0,
            earnedBy(employee, allowance, year - 1, 12) -
              (await annualLeaveUsed(db, employee.id, year - 1)),
          ),
        )
      : 0;
  const earned = earnedBy(employee, allowance, year, month);
  const used = await annualLeaveUsed(db, employee.id, year);

  return {
    year,
    allowance,
    accrual: employee.annualLeaveAccrual as "upfront" | "monthly",
    earned,
    carried,
    used,
    remaining: Math.max(0, earned + carried - used),
  };
}

/** A leave note is stored encrypted; an unreadable one must not break the whole board. */
export function readNote(stored: string | null) {
  try {
    return decryptField(stored);
  } catch {
    return "This note is encrypted and cannot be read right now.";
  }
}
