import { afterAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { payRuns } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("pay run approval", () => {
  it("needs a second person, and records who approved", async () => {
    const org = await world.org("Dual control");
    const o = await world.userIn(org, "owner", "Creator");
    const a = await world.userIn(org, "admin", "Approver");
    const owner = await world.caller(o.user, org);
    const admin = await world.caller(a.user, org);

    const { id: employeeId } = await owner.hr.create({
      name: "Pat Payee",
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

    await owner.payroll.setSalary({
      employeeId,
      annualSalary: 6_000_000,
      currency: "USD",
    });

    const { id } = await owner.payroll.createRun({
      label: "November",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      deductionRateBps: 2000,
    });

    await expect(owner.payroll.approveRun({ id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await admin.payroll.approveRun({ id });

    const [run] = await db.select().from(payRuns).where(eq(payRuns.id, id));

    expect(run!.status).toBe("approved");
    expect(run!.approvedByMemberId).toBe(a.member.id);
  });
});

describe("a person who left during the period", () => {
  it("still gets their final, prorated pay", async () => {
    const org = await world.org("Final pay");
    const o = await world.userIn(org, "owner", "Owner");
    const owner = await world.caller(o.user, org);
    const base = {
      email: null,
      jobTitle: "Engineer",
      department: null,
      location: null,
      startDate: "2025-01-01",
      managerId: null,
      memberId: null,
    };
    const { id: stayer } = await owner.hr.create({
      ...base,
      name: "Stays",
      status: "active",
      endDate: null,
    });
    const { id: leaver } = await owner.hr.create({
      ...base,
      name: "Left mid-month",
      status: "former",
      endDate: "2026-11-15",
    });
    const { id: longGone } = await owner.hr.create({
      ...base,
      name: "Left last year",
      status: "former",
      endDate: "2025-06-30",
    });

    for (const employeeId of [stayer, leaver, longGone]) {
      await owner.payroll.setSalary({
        employeeId,
        annualSalary: 3_650_000,
        currency: "USD",
      });
    }

    const { id } = await owner.payroll.createRun({
      label: "November",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      deductionRateBps: 0,
    });
    const run = await owner.payroll.run({ id });
    const names = run.lines.map((line) => line.employeeName);

    expect(names).toContain("Stays");
    expect(names).toContain("Left mid-month");
    expect(names).not.toContain("Left last year");

    const finalPay = run.lines.find(
      (line) => line.employeeName === "Left mid-month",
    )!;
    const fullPay = run.lines.find((line) => line.employeeName === "Stays")!;

    expect(finalPay.base).toBeGreaterThan(0);
    expect(finalPay.base).toBeLessThan(fullPay.base);
  });
});

describe("someone who changed a bonus", () => {
  it("cannot approve the run either", async () => {
    const org = await world.org("Bonus editor");
    const o = await world.userIn(org, "owner", "Creator");
    const a = await world.userIn(org, "admin", "Bonus setter");
    const c = await world.userIn(org, "admin", "Clean approver");
    const owner = await world.caller(o.user, org);
    const editor = await world.caller(a.user, org);
    const approver = await world.caller(c.user, org);
    const { id: employeeId } = await owner.hr.create({
      name: "Pat",
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

    await owner.payroll.setSalary({
      employeeId,
      annualSalary: 6_000_000,
      currency: "USD",
    });

    const { id } = await owner.payroll.createRun({
      label: "December",
      periodStart: "2026-12-01",
      periodEnd: "2026-12-31",
      deductionRateBps: 2000,
    });
    const run = await owner.payroll.run({ id });

    await editor.payroll.setBonus({
      payslipId: run.lines[0]!.id,
      bonus: 50_000,
    });

    await expect(editor.payroll.approveRun({ id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(approver.payroll.approveRun({ id })).resolves.toEqual({ id });
  });
});

describe("people paid in more than one currency", () => {
  it("get one run per currency for the same period", async () => {
    const org = await world.org("Two currencies");
    const o = await world.userIn(org, "owner", "Owner");
    const owner = await world.caller(o.user, org);
    const base = {
      email: null,
      jobTitle: "Engineer",
      department: null,
      location: null,
      status: "active" as const,
      startDate: null,
      endDate: null,
      managerId: null,
      memberId: null,
    };
    const { id: ana } = await owner.hr.create({ ...base, name: "Ana" });
    const { id: kenji } = await owner.hr.create({ ...base, name: "Kenji" });

    await owner.payroll.setSalary({
      employeeId: ana,
      annualSalary: 6_000_000,
      currency: "USD",
    });
    await owner.payroll.setSalary({
      employeeId: kenji,
      annualSalary: 6_000_000,
      currency: "JPY",
    });

    const period = {
      periodStart: "2027-01-01",
      periodEnd: "2027-01-31",
      deductionRateBps: 0,
    };

    await expect(
      owner.payroll.createRun({ ...period, label: "Jan" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const usd = await owner.payroll.createRun({
      ...period,
      label: "Jan USD",
      currency: "usd",
    });
    const jpy = await owner.payroll.createRun({
      ...period,
      label: "Jan JPY",
      currency: "JPY",
    });

    expect(
      (await owner.payroll.run({ id: usd.id })).lines.map(
        (l) => l.employeeName,
      ),
    ).toEqual(["Ana"]);
    expect(
      (await owner.payroll.run({ id: jpy.id })).lines.map(
        (l) => l.employeeName,
      ),
    ).toEqual(["Kenji"]);

    await expect(
      owner.payroll.createRun({
        ...period,
        label: "Jan JPY again",
        currency: "JPY",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const runs = (await owner.payroll.runs()).runs;

    expect(runs.map((r) => r.currency).sort()).toEqual(["JPY", "USD"]);
  });
});
