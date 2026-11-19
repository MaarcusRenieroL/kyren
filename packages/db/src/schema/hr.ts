import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";

/**
 * A person on the payroll of the organization. It may be linked to a member
 * (who then sees their own record), but hires without an account are allowed.
 */
export const employees = pgTable(
  "employee",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("memberId").references(() => members.id, {
      onDelete: "set null",
    }),
    managerId: uuid("managerId").references((): AnyPgColumn => employees.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    email: text("email"),
    jobTitle: text("jobTitle").notNull().default(""),
    department: text("department"),
    location: text("location"),

    status: text("status").notNull().default("active"),
    startDate: date("startDate", { mode: "string" }),
    endDate: date("endDate", { mode: "string" }),
    /** Annual leave days per calendar year; null means no limit is kept. */
    annualLeaveDays: numeric("annualLeaveDays", {
      precision: 5,
      scale: 1,
      mode: "number",
    }),
    /** Most unused days that move on to the next year; null or 0 means none. */
    /** "upfront": the year's allowance on 1 January; "monthly": a twelfth a month. */
    annualLeaveAccrual: text("annualLeaveAccrual").notNull().default("upfront"),
    annualLeaveCarryOverDays: numeric("annualLeaveCarryOverDays", {
      precision: 5,
      scale: 1,
      mode: "number",
    }),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    check(
      "employee_annual_leave_accrual_check",
      sql`${table.annualLeaveAccrual} in ('upfront', 'monthly')`,
    ),
    index("employee_organization_idx").on(table.organizationId),
    uniqueIndex("employee_member_unique").on(
      table.organizationId,
      table.memberId,
    ),
  ],
);

export const leaveRequests = pgTable(
  "leaveRequest",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employeeId")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    type: text("type").notNull().default("annual"),
    startDate: date("startDate", { mode: "string" }).notNull(),
    endDate: date("endDate", { mode: "string" }).notNull(),
    days: numeric("days", { precision: 5, scale: 1, mode: "number" }).notNull(),
    note: text("note"),

    status: text("status").notNull().default("pending"),
    decidedByMemberId: uuid("decidedByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decidedAt"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("leave_request_employee_idx").on(table.employeeId),
    index("leave_request_status_idx").on(table.organizationId, table.status),
  ],
);

export type Employee = typeof employees.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
