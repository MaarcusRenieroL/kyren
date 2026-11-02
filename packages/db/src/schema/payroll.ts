import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";
import { employees } from "./hr";

/** What an employee is paid. Amounts are whole minor units (cents). */
export const compensations = pgTable(
  "compensation",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employeeId")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    annualSalary: integer("annualSalary").notNull(),
    currency: text("currency").notNull().default("USD"),

    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("compensation_employee_unique").on(table.employeeId),
    check("compensation_salary_check", sql`${table.annualSalary} >= 0`),
  ],
);

/** One pay period. Moves draft → approved → paid and is then frozen. */
export const payRuns = pgTable(
  "payRun",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("createdByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),

    label: text("label").notNull(),
    periodStart: date("periodStart", { mode: "string" }).notNull(),
    periodEnd: date("periodEnd", { mode: "string" }).notNull(),
    /** Share of gross held back as tax and contributions, in basis points. */
    deductionRateBps: integer("deductionRateBps").notNull().default(2000),

    status: text("status").notNull().default("draft"),
    approvedAt: timestamp("approvedAt"),
    paidAt: timestamp("paidAt"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("pay_run_organization_idx").on(table.organizationId),
    // One run per period, so a double click or retry cannot pay twice.
    uniqueIndex("pay_run_period_unique").on(
      table.organizationId,
      table.periodStart,
      table.periodEnd,
    ),
    check(
      "pay_run_rate_check",
      sql`${table.deductionRateBps} between 0 and 10000`,
    ),
    check(
      "pay_run_status_check",
      sql`${table.status} in ('draft', 'approved', 'paid')`,
    ),
  ],
);

/** One employee's line in a pay run, with the figures frozen at creation. */
export const payslips = pgTable(
  "payslip",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    payRunId: uuid("payRunId")
      .notNull()
      .references(() => payRuns.id, { onDelete: "cascade" }),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employeeId").references(() => employees.id, {
      onDelete: "set null",
    }),

    employeeName: text("employeeName").notNull(),
    currency: text("currency").notNull().default("USD"),
    base: integer("base").notNull(),
    bonus: integer("bonus").notNull().default(0),
    deductions: integer("deductions").notNull(),
    net: integer("net").notNull(),
  },
  (table) => [
    index("payslip_run_idx").on(table.payRunId),
    index("payslip_employee_idx").on(table.employeeId),
    uniqueIndex("payslip_run_employee_unique").on(
      table.payRunId,
      table.employeeId,
    ),
    check(
      "payslip_amounts_check",
      sql`${table.base} >= 0 and ${table.bonus} >= 0 and ${table.deductions} >= 0 and ${table.net} >= 0`,
    ),
  ],
);

export type PayRun = typeof payRuns.$inferSelect;
export type Payslip = typeof payslips.$inferSelect;
