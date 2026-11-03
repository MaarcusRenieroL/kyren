import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { leaveRequests } from "@zentro/db/schema";

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

describe("the private reason on a leave request", () => {
  it("is encrypted in the database and readable through the API", async () => {
    process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

    try {
      const org = await world.org("Leave notes");
      const o = await world.userIn(org, "owner", "Note Owner");
      const m = await world.userIn(org, "member", "Note Member");
      const owner = await world.caller(o.user, org);
      const member = await world.caller(m.user, org);

      await owner.hr.create(person(m.member.id, "Note Member"));
      await member.hr.leaveRequest({
        type: "sick",
        startDate: "2027-03-01",
        endDate: "2027-03-02",
        note: "Chemotherapy appointment",
      });

      const [row] = await db
        .select({ note: leaveRequests.note })
        .from(leaveRequests)
        .where(eq(leaveRequests.organizationId, org.id));

      expect(row!.note).toMatch(/^enc:v1:/);
      expect(row!.note).not.toContain("Chemotherapy");

      const { requests } = await owner.hr.leaveList();

      expect(requests[0]!.note).toBe("Chemotherapy appointment");

      delete process.env.FIELD_ENCRYPTION_KEY;
      expect((await owner.hr.leaveList()).requests[0]!.note).toMatch(
        /cannot be read/,
      );
    } finally {
      delete process.env.FIELD_ENCRYPTION_KEY;
    }
  });
});
