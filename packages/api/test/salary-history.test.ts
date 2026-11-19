import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("salary history", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let employeeId: string;

  beforeAll(async () => {
    const org = await world.org("Pay history");
    owner = await world.caller(
      (await world.userIn(org, "owner", "Pay Admin")).user,
      org,
    );
    member = await world.caller(
      (await world.userIn(org, "member", "Pay Member")).user,
      org,
    );
    const other = await world.org("Pay elsewhere");
    outsider = await world.caller(
      (await world.userIn(other, "owner", "Other Admin")).user,
      other,
    );
    ({ id: employeeId } = await owner.hr.create({
      name: "Rae Raise",
      email: null,
      jobTitle: "Engineer",
      department: null,
      location: null,
      status: "active",
      startDate: null,
      endDate: null,
      managerId: null,
      memberId: null,
      annualLeaveDays: null,
    }));
  });

  it("keeps each change once, newest first, with who made it", async () => {
    await owner.payroll.setSalary({
      employeeId,
      annualSalary: 6_000_000,
      currency: "USD",
    });
    // Saving the same figure again adds nothing.
    await owner.payroll.setSalary({
      employeeId,
      annualSalary: 6_000_000,
      currency: "USD",
    });
    await owner.payroll.setSalary({
      employeeId,
      annualSalary: 7_000_000,
      currency: "USD",
    });

    const history = await owner.payroll.salaryHistory({ employeeId });

    expect(history.map((row) => row.annualSalary)).toEqual([
      7_000_000, 6_000_000,
    ]);
    expect(history[0]!.changedBy).toBe("Pay Admin");
  });

  it("is closed to members and to other organizations", async () => {
    await expect(
      member.payroll.salaryHistory({ employeeId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await outsider.payroll.salaryHistory({ employeeId })).toEqual([]);
  });

  it("records one change when the first salary is saved twice at once", async () => {
    const { id } = await owner.hr.create({
      name: "Twin Save",
      email: null,
      jobTitle: "Engineer",
      department: null,
      location: null,
      status: "active",
      startDate: null,
      endDate: null,
      managerId: null,
      memberId: null,
    });

    await Promise.all(
      [1, 2].map(() =>
        owner.payroll.setSalary({
          employeeId: id,
          annualSalary: 5_000_000,
          currency: "USD",
        }),
      ),
    );

    expect(await owner.payroll.salaryHistory({ employeeId: id })).toHaveLength(
      1,
    );
  });
});
