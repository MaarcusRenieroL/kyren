import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const person = (memberId: string, name: string) => ({
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

describe("time off on the calendar", () => {
  let owner: Caller;
  let sam: Caller;
  let ana: Caller;
  let outsider: Caller;
  let org: Awaited<ReturnType<World["org"]>>;
  let samUser: Awaited<ReturnType<World["user"]>>;

  beforeAll(async () => {
    org = await world.org("Time off");
    const o = await world.userIn(org, "owner", "Boss");
    const s = await world.userIn(org, "member", "Sam");

    samUser = s.user;
    const a = await world.userIn(org, "member", "Ana");
    const other = await world.org("Time off elsewhere");
    const x = await world.userIn(other, "owner", "Other Boss");

    owner = await world.caller(o.user, org);
    sam = await world.caller(s.user, org);
    ana = await world.caller(a.user, org);
    outsider = await world.caller(x.user, other);

    await owner.hr.create(person(s.member.id, "Sam Sick"));
    await owner.hr.create(person(a.member.id, "Ana Away"));

    const approve = async (
      caller: Caller,
      request: Parameters<Caller["hr"]["leaveRequest"]>[0],
    ) => {
      const { id } = await caller.hr.leaveRequest(request);

      await owner.hr.leaveDecide({ id, decision: "approved" });
    };

    await approve(sam, {
      type: "sick",
      startDate: "2030-03-04",
      endDate: "2030-03-05",
      note: null,
    });
    await approve(ana, {
      type: "annual",
      startDate: "2030-03-11",
      endDate: "2030-03-15",
      note: null,
    });
    // Still pending: not on anyone's calendar.
    await ana.hr.leaveRequest({
      type: "annual",
      startDate: "2030-03-20",
      endDate: "2030-03-21",
      note: null,
    });
    // Leave in another organization, in the same weeks.
    const e = await world.userIn(other, "member", "Elsewhere");
    const elsewhere = await world.caller(e.user, other);

    await outsider.hr.create(person(e.member.id, "Elsewhere Person"));

    const { id: foreignLeave } = await elsewhere.hr.leaveRequest({
      type: "annual",
      startDate: "2030-03-04",
      endDate: "2030-03-06",
      note: null,
    });

    await outsider.hr.leaveDecide({ id: foreignLeave, decision: "approved" });
  });

  it("shows approved time off in the range, and hides the kind from colleagues", async () => {
    const seen = await ana.hr.timeOff({ from: "2030-03-01", to: "2030-03-31" });

    expect(seen.map((leave) => leave.name)).toEqual(["Sam Sick", "Ana Away"]);
    // Ana sees her own kind of leave, but not that Sam is sick.
    expect(seen.find((leave) => leave.name === "Sam Sick")!.type).toBeNull();
    expect(seen.find((leave) => leave.name === "Ana Away")!.type).toBe(
      "annual",
    );

    // HR managers see the kind.
    const forBoss = await owner.hr.timeOff({
      from: "2030-03-01",
      to: "2030-03-31",
    });

    expect(forBoss.find((leave) => leave.name === "Sam Sick")!.type).toBe(
      "sick",
    );
  });

  it("hides people who have left from colleagues, like the directory", async () => {
    const [sam] = (await owner.hr.directory()).people.filter(
      (person) => person.name === "Sam Sick",
    );

    await owner.hr.update({
      id: sam!.id,
      data: {
        name: "Sam Sick",
        email: null,
        jobTitle: "Engineer",
        department: null,
        location: null,
        status: "former",
        startDate: null,
        endDate: null,
        managerId: null,
        memberId: sam!.memberId,
      },
    });

    const range = { from: "2030-03-01", to: "2030-03-31" };

    expect((await ana.hr.timeOff(range)).map((l) => l.name)).not.toContain(
      "Sam Sick",
    );
    expect((await owner.hr.timeOff(range)).map((l) => l.name)).toContain(
      "Sam Sick",
    );
  });

  it("only returns leave that overlaps the range", async () => {
    const week = await owner.hr.timeOff({
      from: "2030-03-05",
      to: "2030-03-10",
    });

    expect(week.map((leave) => leave.name)).toEqual(["Sam Sick"]);
    await expect(
      owner.hr.timeOff({ from: "2030-03-10", to: "2030-01-01" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.hr.timeOff({ from: "2030-01-01", to: "2030-12-31" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("stays inside the organization and needs the directory permission", async () => {
    // Each organization sees only its own people.
    expect(
      (await outsider.hr.timeOff({ from: "2030-03-01", to: "2030-03-31" })).map(
        (leave) => leave.name,
      ),
    ).toEqual(["Elsewhere Person"]);

    await world.override(org, samUser, "hr.view", "deny");
    const blocked = await world.caller(samUser, org);

    await expect(
      blocked.hr.timeOff({ from: "2030-03-01", to: "2030-03-31" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
