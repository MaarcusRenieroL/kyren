import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { countWeekdays } from "../src/server/routers/hr";
import { computePay } from "../src/server/routers/payroll";
import { setupPeopleOrg } from "./helpers/people-fixture";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("pure helpers", () => {
  it("counts weekdays and skips weekends", () => {
    // Mon 2 Nov – Sun 8 Nov 2026
    expect(countWeekdays("2026-11-02", "2026-11-08")).toBe(5);
    expect(countWeekdays("2026-11-07", "2026-11-08")).toBe(0);
    expect(countWeekdays("2026-11-02", "2026-11-02")).toBe(1);
  });

  it("computes deductions and net in minor units", () => {
    expect(computePay(500_000, 100_000, 2000)).toEqual({
      deductions: 120_000,
      net: 480_000,
    });
    expect(computePay(333_333, 0, 2000).net).toBe(266_666);
  });
});

describe("tickets", () => {
  let ctx: Awaited<ReturnType<typeof setupPeopleOrg>>;
  let other: Awaited<ReturnType<typeof setupPeopleOrg>>;

  beforeAll(async () => {
    ctx = await setupPeopleOrg(world, "Tickets A");
    other = await setupPeopleOrg(world, "Tickets B");
  });

  it("numbers tickets per organization", async () => {
    const first = await ctx.asMember.tickets.create({
      subject: "Card declined",
      requesterName: "Acme",
    });
    const second = await ctx.asMember.tickets.create({
      subject: "Invoice copy",
      requesterName: "Acme",
    });
    const elsewhere = await other.asMember.tickets.create({
      subject: "Hello",
      requesterName: "Zed",
    });

    expect(first.ref).toBe("SUP-1");
    expect(second.ref).toBe("SUP-2");
    expect(elsewhere.ref).toBe("SUP-1");
  });

  it("parks a ticket as pending after a reply, and notes do not", async () => {
    const { id } = await ctx.asMember.tickets.create({
      subject: "Reply flow",
      requesterName: "Acme",
    });

    await ctx.asMember.tickets.reply({ id, kind: "note", body: "internal" });
    expect((await ctx.asMember.tickets.get({ id })).status).toBe("open");

    await ctx.asMember.tickets.reply({ id, kind: "reply", body: "On it" });

    const ticket = await ctx.asMember.tickets.get({ id });

    expect(ticket.status).toBe("pending");
    expect(ticket.messages.map((message) => message.kind)).toEqual([
      "note",
      "reply",
    ]);
  });

  it("stamps resolvedAt and keeps tickets inside their organization", async () => {
    const { id } = await ctx.asMember.tickets.create({
      subject: "Resolve me",
      requesterName: "Acme",
    });

    await ctx.asMember.tickets.update({ id, status: "resolved" });
    expect((await ctx.asMember.tickets.get({ id })).resolvedAt).not.toBeNull();

    await expect(other.asOwner.tickets.get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      other.asOwner.tickets.update({ id, status: "open" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses an assignee from another organization and an unknown task", async () => {
    const { id } = await ctx.asMember.tickets.create({
      subject: "Assign",
      requesterName: "Acme",
    });

    await expect(
      ctx.asMember.tickets.update({ id, assigneeMemberId: other.memberId }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      ctx.asMember.tickets.linkTask({ id, taskKey: "NOPE-1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("only lets people with tickets.delete remove a ticket", async () => {
    const { id } = await ctx.asMember.tickets.create({
      subject: "Delete me",
      requesterName: "Acme",
    });

    await expect(ctx.asMember.tickets.remove({ id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(ctx.asOwner.tickets.remove({ id })).resolves.toEqual({ id });
  });
});

describe("admin", () => {
  it("is closed to members and open to owners", async () => {
    const ctx = await setupPeopleOrg(world, "Admin A");

    await expect(ctx.asMember.admin.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const overview = await ctx.asOwner.admin.overview();

    expect(overview.members).toBe(2);
    expect(overview.setup.map((step) => step.id)).toContain("logo");
    expect((await ctx.asOwner.admin.usage()).uploaders).toEqual([]);
    expect(
      (await ctx.asOwner.admin.security()).privileged.map((p) => p.role),
    ).toContain("owner");
  });
});
