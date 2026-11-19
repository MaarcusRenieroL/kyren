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

describe("an HR manager cannot borrow someone else's record", () => {
  let hrManager: Awaited<ReturnType<World["caller"]>>;
  let otherHr: Awaited<ReturnType<World["caller"]>>;
  let selfMemberId: string;
  let ownRecord: string;
  let colleagueRecord: string;
  let colleagueMemberId: string;

  beforeAll(async () => {
    const org = await world.org("HR relink");
    const o = await world.userIn(org, "owner", "Owner");
    const a = await world.userIn(org, "admin", "Sneaky HR");
    const c = await world.userIn(org, "member", "Colleague");

    hrManager = await world.caller(a.user, org);
    otherHr = await world.caller(o.user, org);
    selfMemberId = a.member.id;
    colleagueMemberId = c.member.id;

    ownRecord = (await otherHr.hr.create(person(a.member.id, "Sneaky HR"))).id;
    colleagueRecord = (
      await otherHr.hr.create(person(c.member.id, "Colleague"))
    ).id;
  });

  it("cannot unlink their own record", async () => {
    await expect(
      hrManager.hr.update({ id: ownRecord, data: person(null, "Sneaky HR") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cannot move a colleague's record onto their own account", async () => {
    await otherHr.hr.update({ id: ownRecord, data: person(null, "Sneaky HR") });

    await expect(
      hrManager.hr.update({
        id: colleagueRecord,
        data: person(selfMemberId, "Colleague"),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("can still edit other details, and another HR manager can relink", async () => {
    await expect(
      hrManager.hr.update({
        id: colleagueRecord,
        data: { ...person(colleagueMemberId, "Colleague"), jobTitle: "Lead" },
      }),
    ).resolves.toEqual({ id: colleagueRecord });
    await expect(
      otherHr.hr.update({
        id: ownRecord,
        data: person(selfMemberId, "Sneaky HR"),
      }),
    ).resolves.toEqual({ id: ownRecord });
  });
});

describe("the people directory for a member", () => {
  it("shows name, title, team and location, not HR's details", async () => {
    const org = await world.org("Directory privacy");
    const o = await world.userIn(org, "owner", "Owner");
    const m = await world.userIn(org, "member", "Reader");
    const owner = await world.caller(o.user, org);
    const reader = await world.caller(m.user, org);
    const detailed = {
      ...person(null, "Leaving Soon"),
      email: "leaving@example.test",
      startDate: "2024-01-01",
      endDate: "2026-12-31",
      status: "leaving" as const,
    };

    await owner.hr.create(detailed);
    await owner.hr.create({ ...person(null, "Long Gone"), status: "former" });

    const seen = (await reader.hr.directory()).people;
    const leaving = seen.find((p) => p.name === "Leaving Soon")!;

    expect(seen.map((p) => p.name)).not.toContain("Long Gone");
    expect(leaving).toMatchObject({
      email: null,
      startDate: null,
      endDate: null,
      status: "active",
    });

    const hrView = (await owner.hr.directory()).people;

    expect(hrView.find((p) => p.name === "Leaving Soon")).toMatchObject({
      email: "leaving@example.test",
      status: "leaving",
    });
    expect(hrView.map((p) => p.name)).toContain("Long Gone");
  });
});
