import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const person = (
  memberId: string,
  name: string,
  annualLeaveDays: number | null,
) => ({
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
  annualLeaveDays,
});

// Mondays to Fridays in 2031, so day counts are plain weekdays.
const leave = (
  type: "annual" | "sick",
  startDate: string,
  endDate: string,
) => ({
  type,
  startDate,
  endDate,
  note: null,
});

describe("annual leave balance", () => {
  let owner: Caller;
  let ana: Caller;
  let ben: Caller;

  beforeAll(async () => {
    const org = await world.org("Leave balance");
    const o = await world.userIn(org, "owner", "Boss");
    const a = await world.userIn(org, "member", "Ana");
    const b = await world.userIn(org, "member", "Ben");

    owner = await world.caller(o.user, org);
    ana = await world.caller(a.user, org);
    ben = await world.caller(b.user, org);
    await owner.hr.create(person(a.member.id, "Ana Allowance", 5));
    await owner.hr.create(person(b.member.id, "Ben Unlimited", null));
  });

  it("counts pending and approved days against the allowance, and refuses more", async () => {
    // Mon 6 – Wed 8 Jan 2031: 3 days, approved.
    const { id } = await ana.hr.leaveRequest(
      leave("annual", "2031-01-06", "2031-01-08"),
    );

    await owner.hr.leaveDecide({ id, decision: "approved" });
    // Mon 13 – Tue 14 Jan: 2 days, still pending; it counts too.
    await ana.hr.leaveRequest(leave("annual", "2031-01-13", "2031-01-14"));

    await expect(
      ana.hr.leaveRequest(leave("annual", "2031-02-03", "2031-02-03")),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You have no annual leave left in 2031.",
    });
    // Sick leave isn't taken from the allowance.
    await expect(
      ana.hr.leaveRequest(leave("sick", "2031-02-03", "2031-02-03")),
    ).resolves.toBeTruthy();
  });

  it("gives days back when a request is rejected, and says how many are left", async () => {
    const { id } = await ana.hr
      .leaveRequest(leave("annual", "2031-03-03", "2031-03-03"))
      .catch(() => ({ id: "" }));

    expect(id).toBe("");

    const pending = (await owner.hr.leaveList()).requests.find(
      (request) => request.startDate === "2031-01-13",
    )!;

    await owner.hr.leaveDecide({ id: pending.id, decision: "rejected" });
    await expect(
      ana.hr.leaveRequest(leave("annual", "2031-03-03", "2031-03-06")),
    ).rejects.toMatchObject({
      message: "You have 2 days of annual leave left in 2031.",
    });
    await expect(
      ana.hr.leaveRequest(leave("annual", "2031-03-03", "2031-03-04")),
    ).resolves.toBeTruthy();
  });

  it("keeps the allowance when an update leaves it out", async () => {
    const [ana] = (await owner.hr.directory()).people.filter(
      (person) => person.name === "Ana Allowance",
    );

    await owner.hr.update({
      id: ana!.id,
      data: {
        name: "Ana Allowance",
        email: null,
        jobTitle: "Lead",
        department: null,
        location: null,
        status: "active",
        startDate: null,
        endDate: null,
        managerId: null,
        memberId: ana!.memberId,
      },
    });

    expect(
      (await owner.hr.directory()).people.find(
        (person) => person.name === "Ana Allowance",
      )!.annualLeaveDays,
    ).toBe(5);
  });

  it("keeps no limit, and shows no balance, when no allowance is set", async () => {
    await expect(
      ben.hr.leaveRequest(leave("annual", "2031-01-06", "2031-01-31")),
    ).resolves.toBeTruthy();
    expect((await ben.hr.leaveList()).balance).toBeNull();
  });
});

describe("carrying annual leave over", () => {
  it("adds last year's unused days up to the limit, for one year only", async () => {
    const org = await world.org("Leave carry over");
    const o = await world.userIn(org, "owner", "Carry Boss");
    const c = await world.userIn(org, "member", "Cara");
    const owner = await world.caller(o.user, org);
    const cara = await world.caller(c.user, org);

    await owner.hr.create({
      ...person(c.member.id, "Cara Carry", 5),
      annualLeaveCarryOverDays: 3,
    });

    // 2030: one day used of five, so four unused; at most three carry over.
    await cara.hr.leaveRequest(leave("annual", "2030-03-04", "2030-03-04"));

    // 2031: five plus three. Mon 6 – Wed 15 Jan is eight weekdays.
    await expect(
      cara.hr.leaveRequest(leave("annual", "2031-01-06", "2031-01-15")),
    ).resolves.toBeTruthy();
    await expect(
      cara.hr.leaveRequest(leave("annual", "2031-02-03", "2031-02-03")),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You have no annual leave left in 2031.",
    });

    // 2032: 2031 used all of its own five, so nothing carries; carried days
    // never pile up. Five weekdays fit, a sixth does not.
    await expect(
      cara.hr.leaveRequest(leave("annual", "2032-01-05", "2032-01-09")),
    ).resolves.toBeTruthy();
    await expect(
      cara.hr.leaveRequest(leave("annual", "2032-02-02", "2032-02-02")),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("carries nothing into someone's first year", async () => {
    const org = await world.org("Leave carry new hire");
    const o = await world.userIn(org, "owner", "Hire Boss");
    const n = await world.userIn(org, "member", "Nia");
    const owner = await world.caller(o.user, org);
    const nia = await world.caller(n.user, org);

    await owner.hr.create({
      ...person(n.member.id, "Nia New", 2),
      startDate: "2031-01-01",
      annualLeaveCarryOverDays: 5,
    });

    // Mon 6 – Wed 8 Jan 2031 is three days; only two are allowed.
    await expect(
      nia.hr.leaveRequest(leave("annual", "2031-01-06", "2031-01-08")),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You have 2 days of annual leave left in 2031.",
    });
  });

  it("is set by HR managers only", async () => {
    const org = await world.org("Leave carry rights");
    const m = await world.userIn(org, "member", "Rights Member");
    const member = await world.caller(m.user, org);

    await expect(
      member.hr.create({
        ...person(m.member.id, "Self Service", 30),
        annualLeaveCarryOverDays: 30,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("monthly leave accrual", () => {
  it("earns a twelfth a month, and a request can use only what its month has earned", async () => {
    const org = await world.org("Leave accrual");
    const o = await world.userIn(org, "owner", "Accrual Boss");
    const a = await world.userIn(org, "member", "Asha");
    const owner = await world.caller(o.user, org);
    const asha = await world.caller(a.user, org);

    await owner.hr.create({
      ...person(a.member.id, "Asha Accrual", 12),
      annualLeaveAccrual: "monthly",
    });

    // January has earned one day: two are refused, one fits (Mon 6 Jan 2031).
    await expect(
      asha.hr.leaveRequest(leave("annual", "2031-01-06", "2031-01-07")),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You have 1 day of annual leave left in 2031.",
    });
    await asha.hr.leaveRequest(leave("annual", "2031-01-06", "2031-01-06"));

    // By March three are earned and one is used: two more fit, a third not.
    await asha.hr.leaveRequest(leave("annual", "2031-03-03", "2031-03-04"));
    await expect(
      asha.hr.leaveRequest(leave("annual", "2031-03-05", "2031-03-05")),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("starts earning in the month someone joins, and keeps upfront as the default", async () => {
    const org = await world.org("Leave accrual joiner");
    const o = await world.userIn(org, "owner", "Joiner Boss");
    const j = await world.userIn(org, "member", "Jo");
    const u = await world.userIn(org, "member", "Uma");
    const owner = await world.caller(o.user, org);
    const jo = await world.caller(j.user, org);
    const uma = await world.caller(u.user, org);

    await owner.hr.create({
      ...person(j.member.id, "Jo Joiner", 12),
      startDate: "2031-07-01",
      annualLeaveAccrual: "monthly",
    });
    await owner.hr.create(person(u.member.id, "Uma Upfront", 12));

    // July is Jo's first month: one day earned.
    await expect(
      jo.hr.leaveRequest(leave("annual", "2031-07-07", "2031-07-08")),
    ).rejects.toMatchObject({
      message: "You have 1 day of annual leave left in 2031.",
    });
    // Uma has the whole year from January (Mon 6 – Fri 10 Jan).
    await expect(
      uma.hr.leaveRequest(leave("annual", "2031-01-06", "2031-01-10")),
    ).resolves.toBeTruthy();
  });
});
