import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

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

async function setup(name: string) {
  const org = await world.org(name);
  const { user: owner } = await world.userIn(org, "owner", `${name} owner`);
  const { user: member, member: memberRow } = await world.userIn(
    org,
    "member",
    `${name} member`,
  );

  const { user: admin } = await world.userIn(org, "admin", `${name} admin`);

  return {
    asOwner: await world.caller(owner, org),
    asAdmin: await world.caller(admin, org),
    asMember: await world.caller(member, org),
    memberId: memberRow.id,
  };
}

const settled = async <T>(calls: Promise<T>[]) => {
  const results = await Promise.allSettled(calls);

  return {
    ok: results.filter((r) => r.status === "fulfilled").length,
    codes: results.flatMap((r) =>
      r.status === "rejected" ? [(r.reason as { code?: string }).code] : [],
    ),
  };
};

describe("concurrent writes", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeAll(async () => {
    ctx = await setup("Concurrency");
  });

  it("gives simultaneous tickets distinct numbers without failing", async () => {
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        ctx.asMember.tickets.create({
          subject: `Burst ${index}`,
          requesterName: "Load",
          requesterEmail: null,
          priority: "normal",
          category: null,
          description: "",
        }),
      ),
    );
    const numbers = created.map((ticket) => ticket.ref);

    expect(new Set(numbers).size).toBe(8);
  });

  it("approves a pay run once when two approvals race", async () => {
    const { id: employeeId } = await ctx.asOwner.hr.create(
      person(null, "Race Payee"),
    );

    await ctx.asOwner.payroll.setSalary({
      employeeId,
      annualSalary: 6_000_000,
      currency: "USD",
    });

    const { id } = await ctx.asOwner.payroll.createRun({
      label: "Race run",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      deductionRateBps: 2000,
    });
    // The creator may not approve, so a second admin races themselves.
    const outcome = await settled([
      ctx.asAdmin.payroll.approveRun({ id }),
      ctx.asAdmin.payroll.approveRun({ id }),
    ]);

    expect(outcome.ok).toBe(1);
    expect(outcome.codes).toEqual(["CONFLICT"]);
  });

  it("refuses a second run for the same period", async () => {
    const input = {
      label: "Same period",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      deductionRateBps: 2000,
    };
    const outcome = await settled([
      ctx.asOwner.payroll.createRun(input),
      ctx.asOwner.payroll.createRun({ ...input, label: "Same period again" }),
    ]);

    expect(outcome.ok).toBe(1);
    expect(outcome.codes).toEqual(["CONFLICT"]);
  });

  it("decides a leave request once when two managers race", async () => {
    const { id: employeeId } = await ctx.asOwner.hr.create(
      person(ctx.memberId, "Leave Taker"),
    );

    expect(employeeId).toBeTruthy();

    const { id } = await ctx.asMember.hr.leaveRequest({
      type: "annual",
      startDate: "2026-12-07",
      endDate: "2026-12-08",
      note: null,
    });
    const outcome = await settled([
      ctx.asOwner.hr.leaveDecide({ id, decision: "approved" }),
      ctx.asOwner.hr.leaveDecide({ id, decision: "rejected" }),
    ]);

    expect(outcome.ok).toBe(1);
    expect(outcome.codes).toEqual(["CONFLICT"]);
  });
});
