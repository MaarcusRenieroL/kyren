import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { chatChannels, chatMessages, tickets } from "@kyren/db/schema";

import { applyRetention } from "../src/server/retention";
import { eraseMember } from "../src/server/privacy";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("retention and legal hold", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let channelId: string;
  let memberId: string;

  const messages = async () =>
    (
      await db
        .select({ body: chatMessages.body })
        .from(chatMessages)
        .where(eq(chatMessages.channelId, channelId))
    )
      .map((m) => m.body)
      .sort();

  const ticketSubjects = async () =>
    (
      await db
        .select({ subject: tickets.subject })
        .from(tickets)
        .where(eq(tickets.organizationId, org.id))
    )
      .map((t) => t.subject)
      .sort();

  beforeAll(async () => {
    org = await world.org("Retention");

    const other = await world.org("Retention elsewhere");
    const o = await world.userIn(org, "owner", "Ret Owner");
    const m = await world.userIn(org, "member", "Ret Member");
    const x = await world.userIn(other, "owner", "Ret Outsider");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
    memberId = m.member.id;

    const [channel] = await db
      .insert(chatChannels)
      .values({ organizationId: org.id, name: `ret-${Date.now()}` })
      .returning();

    channelId = channel!.id;

    await db.insert(chatMessages).values([
      {
        organizationId: org.id,
        channelId,
        body: "old",
        createdAt: daysAgo(400),
      },
      {
        organizationId: org.id,
        channelId,
        body: "old but pinned",
        createdAt: daysAgo(400),
        pinnedAt: daysAgo(399),
      },
      {
        organizationId: org.id,
        channelId,
        body: "recent",
        createdAt: daysAgo(5),
      },
    ]);

    const base = { organizationId: org.id, requesterName: "Rin" };

    await db.insert(tickets).values([
      {
        ...base,
        number: 1,
        subject: "old resolved",
        status: "resolved",
        resolvedAt: daysAgo(400),
        updatedAt: daysAgo(400),
      },
      {
        ...base,
        number: 2,
        subject: "old but open",
        status: "open",
        updatedAt: daysAgo(400),
      },
      {
        ...base,
        number: 3,
        subject: "recently resolved",
        status: "resolved",
        resolvedAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
    ]);
  });

  it("lets only people who manage retention read or change it", async () => {
    await expect(member.retention.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      member.retention.setPolicy({ dataType: "chat_messages", days: 90 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      member.retention.setHold({ on: true, reason: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await owner.retention.get()).policies).toEqual([]);
  });

  it("checks the policy: a known kind and a sensible number of days", async () => {
    await expect(
      owner.retention.setPolicy({ dataType: "chat_messages", days: 3 }),
    ).rejects.toBeDefined();
    await expect(
      owner.retention.setPolicy({ dataType: "nonsense" as never, days: 90 }),
    ).rejects.toBeDefined();
  });

  it("purges only what the policies cover, never pinned messages or open tickets", async () => {
    await owner.retention.setPolicy({ dataType: "chat_messages", days: 90 });
    await owner.retention.setPolicy({ dataType: "closed_tickets", days: 90 });

    const result = await applyRetention(db);

    expect(result.chatMessages).toBeGreaterThanOrEqual(1);
    expect(await messages()).toEqual(["old but pinned", "recent"]);
    expect(await ticketSubjects()).toEqual([
      "old but open",
      "recently resolved",
    ]);
  });

  it("purges nothing while a legal hold is on, and again once it is lifted", async () => {
    await db.insert(chatMessages).values({
      organizationId: org.id,
      channelId,
      body: "old, held",
      createdAt: daysAgo(500),
    });

    await owner.retention.setHold({ on: true, reason: "Case 2026-17" });
    expect((await owner.retention.get()).hold).toMatchObject({
      reason: "Case 2026-17",
    });
    await applyRetention(db);
    expect(await messages()).toContain("old, held");

    await owner.retention.setHold({ on: false });
    expect((await owner.retention.get()).hold).toBeNull();
    await applyRetention(db);
    expect(await messages()).not.toContain("old, held");
  });

  it("applies a channel's own retention days too, and holds those back as well", async () => {
    await db
      .update(chatChannels)
      .set({ retentionDays: 30 })
      .where(eq(chatChannels.id, channelId));
    await db.insert(chatMessages).values({
      organizationId: org.id,
      channelId,
      body: "channel rule",
      createdAt: daysAgo(60),
    });

    await owner.retention.setHold({ on: true, reason: "Hold" });
    await applyRetention(db);
    expect(await messages()).toContain("channel rule");

    await owner.retention.setHold({ on: false });
    await applyRetention(db);
    expect(await messages()).not.toContain("channel rule");
  });

  it("refuses to erase a member while a legal hold is on", async () => {
    await owner.retention.setHold({ on: true, reason: "Hold" });
    await expect(
      eraseMember(db, {
        organizationId: org.id,
        memberId,
        redactContent: false,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await owner.retention.setHold({ on: false });
  });

  it("can be turned off again, and keeps organisations apart", async () => {
    await owner.retention.setPolicy({ dataType: "chat_messages", days: null });
    expect(
      (await owner.retention.get()).policies.map((p) => p.dataType),
    ).toEqual(["closed_tickets"]);
    expect((await outsider.retention.get()).policies).toEqual([]);
  });
});
