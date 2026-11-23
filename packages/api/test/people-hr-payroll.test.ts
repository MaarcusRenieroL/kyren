import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { person, setupPeopleOrg } from "./helpers/people-fixture";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("hr", () => {
  let ctx: Awaited<ReturnType<typeof setupPeopleOrg>>;
  let employeeId: string;

  beforeAll(async () => {
    ctx = await setupPeopleOrg(world, "People A");
    ({ id: employeeId } = await ctx.asOwner.hr.create(person(ctx.memberId)));
  });

  it("lets members read the directory but not change it", async () => {
    const directory = await ctx.asMember.hr.directory();

    expect(directory.canManage).toBe(false);
    expect(directory.people.map((p) => p.name)).toContain("Pat Member");
    expect(directory.myEmployeeId).toBe(employeeId);
    await expect(
      ctx.asMember.hr.create(person(null, "Sneaky")),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("will not link one account to two people", async () => {
    await expect(
      ctx.asOwner.hr.create(person(ctx.memberId, "Twin")),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("runs a leave request from request to decision", async () => {
    const { id } = await ctx.asMember.hr.leaveRequest({
      type: "annual",
      startDate: "2026-11-02",
      endDate: "2026-11-06",
      note: null,
    });

    await expect(
      ctx.asMember.hr.leaveDecide({ id, decision: "approved" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const mine = await ctx.asMember.hr.leaveList();

    expect(mine.requests).toHaveLength(1);
    expect(mine.requests[0]).toMatchObject({ days: 5, status: "pending" });

    await ctx.asOwner.hr.leaveDecide({ id, decision: "approved" });
    await expect(
      ctx.asOwner.hr.leaveDecide({ id, decision: "rejected" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a weekend-only request", async () => {
    await expect(
      ctx.asMember.hr.leaveRequest({
        type: "annual",
        startDate: "2026-11-07",
        endDate: "2026-11-08",
        note: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("payroll", () => {
  let ctx: Awaited<ReturnType<typeof setupPeopleOrg>>;
  let employeeId: string;
  let runId: string;

  beforeAll(async () => {
    ctx = await setupPeopleOrg(world, "Pay A");
    ({ id: employeeId } = await ctx.asOwner.hr.create(person(ctx.memberId)));
  });

  it("hides pay runs and salaries from members", async () => {
    await expect(ctx.asMember.payroll.runs()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(ctx.asMember.payroll.salaries()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      ctx.asMember.payroll.setSalary({
        employeeId,
        annualSalary: 1,
        currency: "USD",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("needs a salary before a run can start", async () => {
    await expect(
      ctx.asOwner.payroll.createRun({
        label: "Empty",
        periodStart: "2026-11-01",
        periodEnd: "2026-11-30",
        deductionRateBps: 2000,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("builds a run from salaries and recomputes pay when a bonus is set", async () => {
    await ctx.asOwner.payroll.setSalary({
      employeeId,
      annualSalary: 6_000_000,
      currency: "USD",
    });
    ({ id: runId } = await ctx.asOwner.payroll.createRun({
      label: "November 2026",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      deductionRateBps: 2000,
    }));

    const run = await ctx.asOwner.payroll.run({ id: runId });

    expect(run.lines).toHaveLength(1);
    expect(run.lines[0]).toMatchObject({
      base: 500_000,
      bonus: 0,
      deductions: 100_000,
      net: 400_000,
    });

    await ctx.asOwner.payroll.setBonus({
      payslipId: run.lines[0]!.id,
      bonus: 100_000,
    });

    const updated = await ctx.asOwner.payroll.run({ id: runId });

    expect(updated.lines[0]).toMatchObject({
      deductions: 120_000,
      net: 480_000,
    });
  });

  it("shows a member their payslip only after approval", async () => {
    expect(await ctx.asMember.payroll.mine()).toEqual([]);

    // Approved by someone other than the owner who created the run.
    const { user: approver } = await world.userIn(ctx.org, "admin", "Approver");

    await (
      await world.caller(approver, ctx.org)
    ).payroll.approveRun({
      id: runId,
    });

    const slips = await ctx.asMember.payroll.mine();

    expect(slips).toHaveLength(1);
    expect(slips[0]).toMatchObject({ net: 480_000, status: "approved" });
  });

  it("freezes a run once it is approved", async () => {
    const run = await ctx.asOwner.payroll.run({ id: runId });

    await expect(
      ctx.asOwner.payroll.setBonus({ payslipId: run.lines[0]!.id, bonus: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      ctx.asOwner.payroll.approveRun({ id: runId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      ctx.asOwner.payroll.deleteRun({ id: runId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await ctx.asOwner.payroll.markPaid({ id: runId });
    expect((await ctx.asOwner.payroll.run({ id: runId })).status).toBe("paid");
  });

  it("keeps a paid person's record: they are marked former, not deleted", async () => {
    await expect(
      ctx.asOwner.hr.remove({ id: employeeId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Their payslip is still theirs to see.
    expect(await ctx.asMember.payroll.mine()).toHaveLength(1);

    // A record made by mistake, never paid, can still be deleted.
    const { id: mistake } = await ctx.asOwner.hr.create(
      person(null, "Typo Person"),
    );

    await expect(ctx.asOwner.hr.remove({ id: mistake })).resolves.toEqual({
      id: mistake,
    });
  });
});
