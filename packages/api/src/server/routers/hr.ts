import { TRPCError } from "@trpc/server";
import {
  alias,
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  ne,
  notInArray,
  sql,
} from "@zentro/db/drizzle";
import {
  employees,
  leaveRequests,
  members,
  payslips,
  users,
} from "@zentro/db/schema";
import { z } from "zod";

import { decryptField, encryptField } from "@zentro/utils/field-crypto";

import { currentMemberId } from "../chat";
import { enforceRateLimit } from "../rate-limit";
import { isoDate, uuid } from "../zod-common";
import { permissionProcedure, router, type OrganizationContext } from "../trpc";

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

const procedure = (permission: string, audit?: string[], also?: string[]) =>
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

const employeeInput = z.object({
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
  /**
   * Most unused annual days that move on to the next year (for one year
   * only); null keeps none. Left out of an update, the current value stays.
   */
  /** How the allowance is earned; left out of an update, it stays. */
  annualLeaveAccrual: z.enum(["upfront", "monthly"]).optional(),
  annualLeaveCarryOverDays: z
    .number()
    .min(0)
    .max(365)
    .multipleOf(0.5)
    .nullable()
    .optional(),
});

/**
 * Annual leave someone has used this calendar year, counting what is still
 * waiting for a decision so two requests can't both spend the same days.
 * A request counts in the year it starts.
 */
async function annualLeaveUsed(
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
 * Someone's annual leave for a year: the allowance, plus what they left
 * unused last year up to their carry-over limit (carried days last one year
 * and never pile up), less what they have used or asked for. Null when no
 * allowance is kept.
 */
async function annualLeaveBalance(
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

/**
 * Annual leave earned in `year` by the end of `month`: all of it on
 * 1 January, or with monthly accrual a twelfth for each month worked so far
 * (from the start month in the year someone joins), rounded down to a half day.
 */
function earnedBy(
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

async function findEmployee(ctx: OrganizationContext, id: string) {
  const [employee] = await ctx.db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, id),
        eq(employees.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!employee) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Person not found." });
  }

  return employee;
}

/** Rejects a manager or member link that belongs to another organization. */
async function assertLinks(
  ctx: OrganizationContext,
  input: { managerId: string | null; memberId: string | null },
  selfId?: string,
) {
  const organizationId = ctx.activeOrganization.id;

  if (input.managerId) {
    if (input.managerId === selfId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Someone can't be their own manager.",
      });
    }

    await findEmployee(ctx, input.managerId);
  }

  if (input.memberId) {
    const [member] = await ctx.db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.id, input.memberId),
          eq(members.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That account isn't in this organization.",
      });
    }

    const [taken] = await ctx.db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.organizationId, organizationId),
          eq(employees.memberId, input.memberId),
        ),
      )
      .limit(1);

    if (taken && taken.id !== selfId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "That account already belongs to another person.",
      });
    }
  }
}

/** The employee record of the caller, when they have one. */
export async function currentEmployee(ctx: OrganizationContext) {
  const memberId = await currentMemberId(ctx);
  const [employee] = await ctx.db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, ctx.activeOrganization.id),
        eq(employees.memberId, memberId),
      ),
    )
    .limit(1);

  return employee ?? null;
}

const manager = alias(employees, "manager");

/** A leave note is stored encrypted; an unreadable one must not break the whole board. */
function readNote(stored: string | null) {
  try {
    return decryptField(stored);
  } catch {
    return "This note is encrypted and cannot be read right now.";
  }
}

export const hrRouter = router({
  directory: procedure("hr.view").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ employee: employees, managerName: manager.name })
      .from(employees)
      .leftJoin(manager, eq(manager.id, employees.managerId))
      .where(eq(employees.organizationId, ctx.activeOrganization.id))
      .orderBy(asc(employees.name));
    const mine = await currentEmployee(ctx);
    const canManage = await ctx.permissions.can("hr.manage");

    // Everyone else gets what the permission promises: name, title, team and
    // location. Contact details, dates and who is leaving stay with HR, and
    // former employees are not listed.
    const visible = canManage
      ? rows
      : rows.filter(({ employee }) => employee.status !== "former");

    return {
      canManage,
      myEmployeeId: mine?.id ?? null,
      people: visible.map(({ employee, managerName }) => {
        const own = mine?.id === employee.id;
        const full = canManage || own;

        return {
          id: employee.id,
          name: employee.name,
          email: full ? employee.email : null,
          jobTitle: employee.jobTitle,
          department: employee.department,
          location: employee.location,
          status:
            full || employee.status !== "leaving" ? employee.status : "active",
          startDate: full ? employee.startDate : null,
          endDate: full ? employee.endDate : null,
          annualLeaveDays: full ? employee.annualLeaveDays : null,
          annualLeaveCarryOverDays: full
            ? employee.annualLeaveCarryOverDays
            : null,
          annualLeaveAccrual: full ? employee.annualLeaveAccrual : null,
          managerId: employee.managerId,
          managerName: managerName ?? null,
          memberId: employee.memberId,
        };
      }),
    };
  }),

  /** Accounts that do not have an employee record yet, for linking. */
  unlinkedMembers: procedure("hr.manage").query(async ({ ctx }) => {
    const linked = await ctx.db
      .select({ memberId: employees.memberId })
      .from(employees)
      .where(eq(employees.organizationId, ctx.activeOrganization.id));
    const taken = linked.flatMap((row) => (row.memberId ? [row.memberId] : []));

    return ctx.db
      .select({ id: members.id, name: users.name, email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          eq(members.organizationId, ctx.activeOrganization.id),
          taken.length ? notInArray(members.id, taken) : undefined,
        ),
      )
      .orderBy(asc(users.name));
  }),

  create: procedure("hr.manage", ["employee.added"])
    .input(employeeInput)
    .mutation(async ({ ctx, input }) => {
      await assertLinks(ctx, input);

      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(employees)
          .values({ ...input, organizationId: ctx.activeOrganization.id })
          .returning({ id: employees.id });

        await ctx.audit.record(tx, {
          action: "employee.added",
          target: { id: row!.id, label: input.name },
        });

        return { id: row!.id };
      });
    }),

  /**
   * Adds people from a spreadsheet, all or nothing. Rows whose email is already
   * on file (or repeated in the file) are skipped, so re-uploading is safe.
   */
  importEmployees: procedure("hr.manage", ["employee.added"])
    .input(
      z.object({
        rows: z
          .array(
            employeeInput.pick({
              name: true,
              email: true,
              jobTitle: true,
              department: true,
              location: true,
              startDate: true,
            }),
          )
          .min(1, "Add at least one row.")
          .max(200, "Import up to 200 people at a time."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;

      await enforceRateLimit(ctx.db, `api:import-people:${ctx.user.id}`, {
        max: 20,
        windowMs: 60 * 60 * 1000,
      });

      return ctx.db.transaction(async (tx) => {
        // One import at a time per organization, so two uploads can't both
        // pass the duplicate check.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`employees:${organizationId}`}, 0))`,
        );

        const existing = await tx
          .select({ email: employees.email })
          .from(employees)
          .where(eq(employees.organizationId, organizationId));
        const seen = new Set(
          existing.flatMap((row) =>
            row.email ? [row.email.toLowerCase()] : [],
          ),
        );
        let created = 0;
        let skipped = 0;

        for (const row of input.rows) {
          const key = row.email?.toLowerCase();

          if (key && seen.has(key)) {
            skipped += 1;
            continue;
          }
          if (key) seen.add(key);

          const [added] = await tx
            .insert(employees)
            .values({ ...row, organizationId })
            .returning({ id: employees.id });

          await ctx.audit.record(tx, {
            action: "employee.added",
            target: { id: added!.id, label: row.name },
            metadata: { imported: true },
          });
          created += 1;
        }

        return { created, skipped };
      });
    }),

  update: procedure("hr.manage", ["employee.updated"])
    .input(z.object({ id: uuid, data: employeeInput }))
    .mutation(async ({ ctx, input }) => {
      const employee = await findEmployee(ctx, input.id);
      const linkFrom = employee.memberId ?? null;
      const linkTo = input.data.memberId ?? null;

      // Who a record belongs to decides whose payslips someone sees and who
      // may approve their leave, so nobody re-points a link that involves
      // their own account; another HR manager has to.
      if (linkFrom !== linkTo) {
        const self = await currentMemberId(ctx);

        if (linkFrom === self || linkTo === self) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Another HR manager has to change which account your own record belongs to.",
          });
        }
      }

      await assertLinks(ctx, input.data, employee.id);

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(employees)
          .set({ ...input.data, updatedAt: new Date() })
          .where(eq(employees.id, employee.id));
        await ctx.audit.record(tx, {
          action: "employee.updated",
          target: { id: employee.id, label: input.data.name },
        });
      });

      return { id: employee.id };
    }),

  remove: procedure("hr.manage", ["employee.removed"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const employee = await findEmployee(ctx, input.id);

      await ctx.db.transaction(async (tx) => {
        // Pay history is a record the person and the books still need, so
        // someone who has been paid is marked as former instead.
        const [paid] = await tx
          .select({ id: payslips.id })
          .from(payslips)
          .where(eq(payslips.employeeId, employee.id))
          .limit(1);

        if (paid) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This person has payroll history. Mark them as former instead of deleting them.",
          });
        }

        await tx.delete(employees).where(eq(employees.id, employee.id));
        await ctx.audit.record(tx, {
          action: "employee.removed",
          target: { id: employee.id, label: employee.name },
        });
      });

      return { id: employee.id };
    }),

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
});
