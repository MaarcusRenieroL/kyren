import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { and, eq } from "@kyren/db/drizzle";
import { activityEvents } from "@kyren/db/schema";

import { minorToDecimal } from "../src/server/payroll-math";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const person = (memberId: string | null, name: string) => ({
  name,
  email: null,
  jobTitle: "Engineer",
  department: null,
  location: null,
  status: "active" as const,
  startDate: null,
  endDate: null,
  managerId: null,
  memberId,
});

describe("off-cycle pay runs", () => {
  let owner: Caller;
  let approver: Caller;
  let member: Caller;
  let outsider: Caller;
  let memberEmployee: string;
  let otherEmployee: string;
  let org: Awaited<ReturnType<World["org"]>>;

  beforeAll(async () => {
    org = await world.org("Off cycle");
    const o = await world.userIn(org, "owner", "Pay Owner");
    const a = await world.userIn(org, "admin", "Second Admin");
    const m = await world.userIn(org, "member", "Paid Member");
    const other = await world.org("Off cycle elsewhere");

    owner = await world.caller(o.user, org);
    approver = await world.caller(a.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(
      (await world.userIn(other, "owner", "Other")).user,
      other,
    );
    ({ id: memberEmployee } = await owner.hr.create(
      person(m.member.id, "Paid Member"),
    ));
    ({ id: otherEmployee } = await outsider.hr.create(
      person(null, "Elsewhere"),
    ));
    await owner.payroll.setSalary({
      employeeId: memberEmployee,
      annualSalary: 6_000_000,
      currency: "USD",
    });
  });

  it("sits beside the month's regular run and pays only what is entered", async () => {
    await owner.payroll.createRun({
      label: "June",
      periodStart: "2031-06-01",
      periodEnd: "2031-06-30",
      deductionRateBps: 2000,
    });
    // A second regular run for June is still refused.
    await expect(
      owner.payroll.createRun({
        label: "June again",
        periodStart: "2031-06-01",
        periodEnd: "2031-06-30",
        deductionRateBps: 2000,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const { id } = await owner.payroll.createOffCycleRun({
      label: "June correction",
      payDate: "2031-06-20",
      currency: "USD",
      deductionRateBps: 2000,
      employeeIds: [memberEmployee],
    });
    const run = await owner.payroll.run({ id });

    expect(run.kind).toBe("off_cycle");
    expect(run.lines).toHaveLength(1);
    expect(run.lines[0]).toMatchObject({ base: 0, net: 0 });

    await owner.payroll.setBonus({
      payslipId: run.lines[0]!.id,
      bonus: 50_000,
    });
    await approver.payroll.approveRun({ id });

    const slips = await member.payroll.mine();
    const correction = slips.find((slip) => slip.label === "June correction")!;

    expect(correction).toMatchObject({
      kind: "off_cycle",
      bonus: 50_000,
      net: 40_000,
    });
  });

  it("is for payroll managers, with people from this organization", async () => {
    await expect(
      member.payroll.createOffCycleRun({
        label: "Sneaky",
        payDate: "2031-07-01",
        currency: "USD",
        employeeIds: [memberEmployee],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.payroll.createOffCycleRun({
        label: "Wrong org",
        payDate: "2031-07-01",
        currency: "USD",
        employeeIds: [otherEmployee],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.payroll.createOffCycleRun({
        label: "Nobody",
        payDate: "2031-07-01",
        currency: "USD",
        employeeIds: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("makes one run from a double submit, and a different date is a new run", async () => {
    const input = {
      label: "Relocation bonus",
      payDate: "2031-08-15",
      currency: "USD",
      employeeIds: [memberEmployee],
    };
    const results = await Promise.allSettled([
      owner.payroll.createOffCycleRun(input),
      owner.payroll.createOffCycleRun({
        ...input,
        label: "relocation BONUS",
      }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")?.reason).toMatchObject({
      code: "CONFLICT",
    });

    // A different date is a different run.
    await expect(
      owner.payroll.createOffCycleRun({ ...input, payDate: "2031-08-16" }),
    ).resolves.toMatchObject({ id: expect.any(String) });
  });

  it("exports an approved run's payment register for managers only, and records it", async () => {
    const runs = (await owner.payroll.runs()).runs;
    const approved = runs.find((run) => run.label === "June correction")!;
    const draft = runs.find((run) => run.label === "Relocation bonus")!;

    const file = await owner.payroll.exportRun({ id: approved.id });
    const [header, row] = file.csv.split("\r\n");

    expect(header).toBe(
      "employee_id,employee,currency,base,bonus,deductions,net,pay_date,reference",
    );
    expect(row).toBe(
      `${memberEmployee},Paid Member,USD,0.00,500.00,100.00,400.00,2031-06-20,June correction`,
    );
    expect(file.filename).toMatch(/^pay-run-2031-06-20-/);

    const [event] = await db
      .select({ metadata: activityEvents.metadata })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.action, "payroll.run_exported"),
          eq(activityEvents.targetId, approved.id),
        ),
      );

    expect(event?.metadata).toMatchObject({ rowCount: 1 });

    await expect(
      member.payroll.exportRun({ id: approved.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.payroll.exportRun({ id: draft.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      outsider.payroll.exportRun({ id: approved.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("shows a payslip to its owner and to payroll staff, never to colleagues or for a draft", async () => {
    const slip = (await member.payroll.mine()).find(
      (row) => row.label === "June correction",
    )!;
    const own = await member.payroll.payslip({ id: slip.id });

    expect(own).toMatchObject({
      organization: org.name,
      employeeName: "Paid Member",
      label: "June correction",
      gross: 50_000,
      deductions: 10_000,
      net: 40_000,
      currency: "USD",
    });
    await expect(owner.payroll.payslip({ id: slip.id })).resolves.toMatchObject(
      { net: 40_000 },
    );

    const c = await world.userIn(org, "member", "Curious Colleague");
    const colleague = await world.caller(c.user, org);

    await expect(
      colleague.payroll.payslip({ id: slip.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      outsider.payroll.payslip({ id: slip.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // A draft's lines are not payslips yet, even for payroll staff.
    const draft = (await owner.payroll.runs()).runs.find(
      (run) => run.label === "Relocation bonus",
    )!;
    const [line] = (await owner.payroll.run({ id: draft.id })).lines;

    await expect(owner.payroll.payslip({ id: line!.id })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );

    // Without the right to see payslips at all, nothing.
    const d = await world.userIn(org, "member", "No Payslips");

    await world.override(org, d.user, "payroll.payslips.view", "deny");
    await expect(
      (await world.caller(d.user, org)).payroll.payslip({ id: slip.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("minorToDecimal", () => {
  it("writes exact amounts in each currency's minor unit", () => {
    expect(minorToDecimal(123_456, "USD")).toBe("1234.56");
    expect(minorToDecimal(5, "USD")).toBe("0.05");
    expect(minorToDecimal(250, "EUR")).toBe("2.50");
    expect(minorToDecimal(1500, "JPY")).toBe("1500");
    expect(minorToDecimal(1234, "BHD")).toBe("1.234");
  });
});
