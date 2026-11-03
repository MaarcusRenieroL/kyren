import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { tickets } from "@zentro/db/schema";

import { slaState } from "../src/server/sla";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const minute = 60_000;
const created = new Date("2027-01-01T09:00:00Z");
const at = (minutes: number) => new Date(created.getTime() + minutes * minute);
const policy = { firstResponseMinutes: 60, resolutionMinutes: 240 };

describe("slaState", () => {
  it("counts down, warns when close, and breaches after the deadline", () => {
    const base = {
      createdAt: created,
      firstRespondedAt: null,
      resolvedAt: null,
    };

    expect(slaState(base, "open", policy, at(10)).response).toMatchObject({
      state: "ok",
      dueAt: at(60),
    });
    expect(slaState(base, "open", policy, at(50)).response.state).toBe(
      "due_soon",
    );
    expect(slaState(base, "open", policy, at(61)).response.state).toBe(
      "breached",
    );
    expect(slaState(base, "open", policy, at(61)).resolution.state).toBe("ok");
  });

  it("is met by an answer given in time and breached by a late one", () => {
    const base = { createdAt: created, resolvedAt: null };

    expect(
      slaState(
        { ...base, firstRespondedAt: at(30) },
        "pending",
        policy,
        at(500),
      ).response,
    ).toMatchObject({ state: "met" });
    expect(
      slaState(
        { ...base, firstRespondedAt: at(90) },
        "pending",
        policy,
        at(100),
      ).response.state,
    ).toBe("breached");
  });

  it("judges a resolved ticket by when it was resolved, and ignores spam or no policy", () => {
    const base = { createdAt: created, firstRespondedAt: at(5) };

    expect(
      slaState({ ...base, resolvedAt: at(200) }, "resolved", policy, at(900))
        .resolution.state,
    ).toBe("met");
    expect(
      slaState({ ...base, resolvedAt: at(300) }, "resolved", policy, at(900))
        .resolution.state,
    ).toBe("breached");
    expect(
      slaState({ ...base, resolvedAt: null }, "spam", policy, at(900))
        .resolution.state,
    ).toBe("none");
    expect(
      slaState(
        { createdAt: created, firstRespondedAt: null, resolvedAt: null },
        "open",
        null,
        at(900),
      ).response,
    ).toEqual({ state: "none", dueAt: null });
  });
});

describe("ticket SLA policy", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let member: Awaited<ReturnType<World["caller"]>>;
  let ticketId: string;

  beforeAll(async () => {
    const org = await world.org("SLA");
    const o = await world.userIn(org, "owner", "Sla Owner");
    const m = await world.userIn(org, "member", "Sla Member");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    ticketId = (
      await owner.tickets.create({
        subject: "Down",
        requesterName: "Rin",
        priority: "urgent",
      })
    ).id;
  });

  it("lets only an administrator set targets, and checks them", async () => {
    await expect(
      member.tickets.setSla({
        priority: "urgent",
        firstResponseMinutes: 60,
        resolutionMinutes: 240,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.tickets.setSla({
        priority: "urgent",
        firstResponseMinutes: 300,
        resolutionMinutes: 60,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await owner.tickets.setSla({
      priority: "urgent",
      firstResponseMinutes: 60,
      resolutionMinutes: 240,
    });
    expect(await member.tickets.slaPolicy()).toEqual([
      { priority: "urgent", firstResponseMinutes: 60, resolutionMinutes: 240 },
    ]);
  });

  it("shows deadlines and state on the ticket, and a reply meets the response target", async () => {
    const before = await owner.tickets.get({ id: ticketId });

    expect(before.sla.response.state).toBe("ok");
    expect(before.sla.response.dueAt).toBeTruthy();

    await owner.tickets.reply({ id: ticketId, body: "On it" });

    expect((await owner.tickets.get({ id: ticketId })).sla.response.state).toBe(
      "met",
    );

    // An internal note is not an answer to the requester.
    const second = await owner.tickets.create({
      subject: "Also down",
      requesterName: "Rin",
      priority: "urgent",
    });

    await owner.tickets.reply({ id: second.id, kind: "note", body: "hmm" });
    expect(
      (await owner.tickets.get({ id: second.id })).sla.response.state,
    ).not.toBe("met");
  });

  it("flags an overdue ticket in the queue", async () => {
    await db
      .update(tickets)
      .set({
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        firstRespondedAt: null,
        status: "open",
      })
      .where(eq(tickets.id, ticketId));

    const { tickets: rows } = await owner.tickets.list({ view: "open" });
    const row = rows.find((t) => t.id === ticketId)!;

    expect(row.sla.response.state).toBe("breached");
    expect(row.sla.resolution.state).toBe("breached");
  });
});
