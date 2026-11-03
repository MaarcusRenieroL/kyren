import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

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

describe("leave requests", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let admin: Awaited<ReturnType<World["caller"]>>;
  let member: Awaited<ReturnType<World["caller"]>>;

  beforeAll(async () => {
    const org = await world.org("Leave integrity");
    const o = await world.userIn(org, "owner", "Leave Owner");
    const a = await world.userIn(org, "admin", "Leave Admin");
    const m = await world.userIn(org, "member", "Leave Member");

    owner = await world.caller(o.user, org);
    admin = await world.caller(a.user, org);
    member = await world.caller(m.user, org);

    await owner.hr.create(person(o.member.id, "Leave Owner"));
    await owner.hr.create(person(m.member.id, "Leave Member"));
  });

  it("refuses a request that overlaps one that is pending or approved", async () => {
    const first = await member.hr.leaveRequest({
      type: "annual",
      startDate: "2027-03-01",
      endDate: "2027-03-05",
      note: null,
    });

    await expect(
      member.hr.leaveRequest({
        type: "annual",
        startDate: "2027-03-03",
        endDate: "2027-03-08",
        note: null,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await owner.hr.leaveDecide({ id: first.id, decision: "approved" });

    await expect(
      member.hr.leaveRequest({
        type: "annual",
        startDate: "2027-03-05",
        endDate: "2027-03-05",
        note: null,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      member.hr.leaveRequest({
        type: "annual",
        startDate: "2027-03-08",
        endDate: "2027-03-09",
        note: null,
      }),
    ).resolves.toHaveProperty("id");
  });

  it("lets the same dates be asked for again after a cancellation or rejection", async () => {
    const request = await member.hr.leaveRequest({
      type: "annual",
      startDate: "2027-04-05",
      endDate: "2027-04-06",
      note: null,
    });

    await member.hr.leaveCancel({ id: request.id });

    await expect(
      member.hr.leaveRequest({
        type: "annual",
        startDate: "2027-04-05",
        endDate: "2027-04-06",
        note: null,
      }),
    ).resolves.toHaveProperty("id");
  });

  it("does not let a manager decide their own request", async () => {
    const own = await owner.hr.leaveRequest({
      type: "annual",
      startDate: "2027-05-03",
      endDate: "2027-05-04",
      note: null,
    });

    await expect(
      owner.hr.leaveDecide({ id: own.id, decision: "approved" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      admin.hr.leaveDecide({ id: own.id, decision: "approved" }),
    ).resolves.toBeTruthy();
  });
});
