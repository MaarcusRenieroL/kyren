import { z } from "zod";
import { isoDate, uuid } from "../../zod-common";
import { permissionProcedure } from "../../trpc";

export const employeeStatuses = [
  "active",
  "on_leave",
  "leaving",
  "former",
] as const;

export const leaveTypes = [
  "annual",
  "sick",
  "unpaid",
  "parental",
  "other",
] as const;

export const procedure = (permission: string, audit?: string[], also?: string[]) =>
  permissionProcedure(permission, undefined, { module: "hr", audit, also });

/** Weekdays from `start` to `end`, both included. */
export function countWeekdays(start: string, end: string) {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  let days = 0;

  for (let day = from; day <= to; day = new Date(+day + 864e5)) {
    const weekday = day.getUTCDay();

    if (weekday !== 0 && weekday !== 6) days += 1;
  }

  return days;
}

export const employeeInput = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  email: z
    .string()
    .trim()
    .email("That email address doesn't look right.")
    .max(200)
    .nullable()
    .default(null),
  jobTitle: z.string().trim().max(120).default(""),
  department: z.string().trim().max(80).nullable().default(null),
  location: z.string().trim().max(80).nullable().default(null),
  status: z.enum(employeeStatuses).default("active"),
  startDate: isoDate.nullable().default(null),
  endDate: isoDate.nullable().default(null),
  managerId: uuid.nullable().default(null),
  memberId: uuid.nullable().default(null),
  /**
   * Days of annual leave a year; null keeps no limit. Left out of an update,
   * the current allowance stays.
   */
  annualLeaveDays: z
    .number()
    .min(0)
    .max(365)
    .multipleOf(0.5)
    .nullable()
    .optional(),
  /** How the allowance is earned; left out of an update, it stays. */
  annualLeaveAccrual: z.enum(["upfront", "monthly"]).optional(),
  /**
   * Most unused annual days that move on to the next year (for one year
   * only); null keeps none. Left out of an update, the current value stays.
   */
  annualLeaveCarryOverDays: z
    .number()
    .min(0)
    .max(365)
    .multipleOf(0.5)
    .nullable()
    .optional(),
});
