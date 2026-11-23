import { and, asc, eq, notInArray } from "@zentro/db/drizzle";
import { employees, members, users } from "@zentro/db/schema";
import { currentEmployee, manager } from "./employees";
import { procedure } from "./types";

export const hrDirectoryProcedures = {
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
};
