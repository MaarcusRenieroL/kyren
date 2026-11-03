import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { employees, leaveRequests } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const day = (offset: number) =>
  new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

describe("tickets show when the assignee is away", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let awayId: string;
  let presentId: string;
  let ticketId: string;
  let presentTicketId: string;

  beforeAll(async () => {
    const org = await world.org("Ticket away");
    const o = await world.userIn(org, "owner", "Priya");
    const away = await world.userIn(org, "member", "Away Agent");
    const present = await world.userIn(org, "member", "Present Agent");

    owner = await world.caller(o.user, org);
    awayId = away.member.id;
    presentId = present.member.id;

    const [employee] = await db
      .insert(employees)
      .values({
        organizationId: org.id,
        memberId: awayId,
        name: "Away Agent",
        jobTitle: "",
      })
      .returning();

    await db.insert(leaveRequests).values({
      organizationId: org.id,
      employeeId: employee!.id,
      startDate: day(-1),
      endDate: day(3),
      days: 4,
      status: "approved",
      note: "Private medical reason",
    });

    ticketId = (
      await owner.tickets.create({
        subject: "Waiting on holiday",
        requesterName: "Rin",
        assigneeMemberId: awayId,
      })
    ).id;
    presentTicketId = (
      await owner.tickets.create({
        subject: "Handled",
        requesterName: "Rin",
        assigneeMemberId: presentId,
      })
    ).id;
  });

  it("marks queue rows whose assignee is on leave, with only the return date", async () => {
    const { tickets } = await owner.tickets.list({ view: "open" });
    const away = tickets.find((t) => t.id === ticketId);
    const present = tickets.find((t) => t.id === presentTicketId);

    expect(away?.assigneeAwayUntil).toBe(day(3));
    expect(present?.assigneeAwayUntil).toBeNull();
    expect(JSON.stringify(tickets)).not.toContain("medical");
  });

  it("marks the same on the ticket itself", async () => {
    expect((await owner.tickets.get({ id: ticketId })).assigneeAwayUntil).toBe(
      day(3),
    );
    expect(
      (await owner.tickets.get({ id: presentTicketId })).assigneeAwayUntil,
    ).toBeNull();
  });

  it("tells the assignee picker who is away", async () => {
    const people = await owner.tickets.assignees();

    expect(people.find((p) => p.id === awayId)?.awayUntil).toBe(day(3));
    expect(people.find((p) => p.id === presentId)?.awayUntil).toBeNull();
  });
});
