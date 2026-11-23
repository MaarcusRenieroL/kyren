import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { employees, leaveRequests } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const day = (offset: number) =>
  new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

async function person(
  organizationId: string,
  memberId: string,
  name: string,
  leave?: { start: string; end: string; status: string },
) {
  const [employee] = await db
    .insert(employees)
    .values({ organizationId, memberId, name, jobTitle: "" })
    .returning();

  if (leave) {
    await db.insert(leaveRequests).values({
      organizationId,
      employeeId: employee!.id,
      startDate: leave.start,
      endDate: leave.end,
      days: 1,
      status: leave.status,
    });
  }
}

describe("approved leave counts as out of office", () => {
  let as: Awaited<ReturnType<World["caller"]>>;
  let ids: Record<string, string>;

  beforeAll(async () => {
    const org = await world.org("OOO leave");
    const other = await world.org("OOO other");
    const owner = await world.userIn(org, "owner", "Owner");
    const away = await world.userIn(org, "member", "Away now");
    const pending = await world.userIn(org, "member", "Pending leave");
    const later = await world.userIn(org, "member", "Leave next month");
    const past = await world.userIn(org, "member", "Back already");
    const foreign = await world.userIn(other, "member", "Elsewhere");

    as = await world.caller(owner.user, org);
    ids = {
      away: away.member.id,
      pending: pending.member.id,
      later: later.member.id,
      past: past.member.id,
      foreign: foreign.member.id,
    };

    await person(org.id, away.member.id, "Away now", {
      start: day(-1),
      end: day(2),
      status: "approved",
    });
    await person(org.id, pending.member.id, "Pending leave", {
      start: day(-1),
      end: day(2),
      status: "pending",
    });
    await person(org.id, later.member.id, "Later", {
      start: day(30),
      end: day(31),
      status: "approved",
    });
    await person(org.id, past.member.id, "Past", {
      start: day(-10),
      end: day(-5),
      status: "approved",
    });
    await person(other.id, foreign.member.id, "Elsewhere", {
      start: day(-1),
      end: day(2),
      status: "approved",
    });
  });

  it("lists members whose approved leave covers today, until the last day", async () => {
    const out = await as.member.getOutOfOffice();

    expect(out.map((entry) => entry.memberId)).toEqual([ids.away]);
    expect(out[0]!.untilDate).toBe(day(2));
  });
});
