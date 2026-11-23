import { afterAll, afterEach, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import {
  jobs,
  platformAnnouncements,
  platformAuditEvents,
  platformIpAllowlist,
  platformSettings,
  sessions,
  twoFactors,
  users,
} from "@zentro/db/schema";

import {
  forgetMaintenance,
  forgetPlatformIpPolicy,
} from "../src/server/platform-policy";
import { createOperator } from "./helpers/platform-helpers";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

afterEach(async () => {
  await db.delete(platformSettings);
  await db.delete(platformIpAllowlist);
  await db.delete(platformAnnouncements);
  forgetMaintenance();
  forgetPlatformIpPolicy();
});

describe("maintenance mode", () => {
  it("makes everything read-only except the console, and ends cleanly", async () => {
    const org = await world.org("Maintenance Co");
    const owner = await world.userIn(org, "owner", "Maint Owner");
    const platform = world.sessionCaller(await createOperator(world)).platform;
    const member = await world.caller(owner.user, org);

    await platform.maintenance.set({ enabled: true, message: "Back at noon" });

    await expect(member.apiKey.list()).resolves.toEqual([]);
    await expect(
      member.organization.setAiPolicy({ enabled: true }),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Back at noon",
    });

    await platform.maintenance.set({ enabled: false, message: "" });
    await expect(
      member.organization.setAiPolicy({ enabled: true }),
    ).resolves.toBeTruthy();
  });
});

describe("the console's IP allow-list", () => {
  it("refuses a first rule that locks the caller out, then hides the console from other networks", async () => {
    const admin = await createOperator(world);
    const platform = world.sessionCaller(admin, { ip: "203.0.113.7" }).platform;

    await expect(
      platform.ipRules.add({ cidr: "198.51.100.0/24" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      platform.ipRules.add({ cidr: "nonsense" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await platform.ipRules.add({ cidr: "203.0.113.0/24", label: "Office" });

    await expect(platform.me()).resolves.toBeTruthy();
    await expect(
      world.sessionCaller(admin, { ip: "192.0.2.9" }).platform.me(),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to remove the rule that lets the caller in", async () => {
    const admin = await createOperator(world);
    const platform = world.sessionCaller(admin, { ip: "203.0.113.7" }).platform;
    const first = await platform.ipRules.add({ cidr: "203.0.113.0/24" });

    await db
      .insert(platformIpAllowlist)
      .values({ cidr: "198.51.100.0/24", label: "Elsewhere" });
    forgetPlatformIpPolicy();
    await platform.ipRules.remove({ id: first.id }).then(
      () => {
        throw new Error("expected a refusal");
      },
      (error: { code: string }) => expect(error.code).toBe("BAD_REQUEST"),
    );
  });
});

describe("announcements", () => {
  it("shows live notices to signed-in users and hides withdrawn or future ones", async () => {
    const admin = await createOperator(world);
    const platform = world.sessionCaller(admin).platform;
    const reader = world.sessionCaller(await world.user("Reader"));
    const live = await platform.announcements.create({
      title: "Planned upgrade",
      severity: "warning",
    });

    await platform.announcements.create({
      title: "Later",
      startsAt: new Date(Date.now() + 3_600_000),
    });

    await expect(reader.announcement.active()).resolves.toMatchObject([
      { title: "Planned upgrade", severity: "warning" },
    ]);

    await platform.announcements.withdraw({ id: live.id });
    await expect(reader.announcement.active()).resolves.toEqual([]);
    await expect(
      world.anonymousCaller().announcement.active(),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("platform health", () => {
  it("shows failed jobs and can retry or discard them", async () => {
    const platform = world.sessionCaller(await createOperator(world)).platform;
    const [dead] = await db
      .insert(jobs)
      .values({
        kind: "ticket_mail",
        payload: {},
        status: "dead",
        attempts: 5,
        lastError: "smtp down",
      })
      .returning();
    const [other] = await db
      .insert(jobs)
      .values({ kind: "ticket_mail", payload: {}, status: "dead" })
      .returning();

    const overview = await platform.health.overview();

    expect(overview.dead.map((job) => job.id)).toEqual(
      expect.arrayContaining([dead!.id, other!.id]),
    );
    expect(overview.databaseMs).toBeGreaterThanOrEqual(0);

    await platform.health.retryJob({ id: dead!.id });
    await platform.health.discardJob({ id: other!.id });

    const [retried] = await db.select().from(jobs).where(eq(jobs.id, dead!.id));

    expect(retried).toMatchObject({ status: "pending", attempts: 0 });
    await db.delete(jobs).where(eq(jobs.id, dead!.id));
  });
});

describe("user lookup, forced sign-out and password reset", () => {
  it("finds a user across organizations and ends their sessions", async () => {
    const org = await world.org("Lookup Co");
    const member = await world.userIn(org, "member", "Findable Person");
    const platform = world.sessionCaller(await createOperator(world)).platform;

    await world.caller(member.user, org);
    await db.insert(sessions).values({
      token: `t-${member.user.id}`,
      userId: member.user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const [found] = await platform.users.lookup({ query: member.user.email });

    expect(found?.memberships.map((m) => m.organizationName)).toContain(
      "Lookup Co",
    );
    expect(found?.sessions).toBeGreaterThan(0);

    const result = await platform.users.signOutEverywhere({
      userId: member.user.id,
    });

    expect(result.ended).toBeGreaterThan(0);
    await expect(
      platform.users.lookup({ query: member.user.email }),
    ).resolves.toMatchObject([{ sessions: 0 }]);
  });
});

describe("two-factor recovery", () => {
  it("lets an operator reset someone who lost their authenticator and backup codes", async () => {
    const org = await world.org("Lost phone Co");
    const person = await world.userIn(org, "member", "Lost Phone");
    const platform = world.sessionCaller(await createOperator(world)).platform;

    await db
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, person.user.id));
    await db.insert(twoFactors).values({
      userId: person.user.id,
      secret: "old-secret",
      backupCodes: "old-codes",
    });
    await db.insert(sessions).values({
      token: `t2-${person.user.id}`,
      userId: person.user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await platform.users.resetTwoFactor({ userId: person.user.id });

    const [after] = await db
      .select({ on: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, person.user.id));

    expect(after?.on).toBe(false);
    expect(
      await db
        .select()
        .from(twoFactors)
        .where(eq(twoFactors.userId, person.user.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, person.user.id)),
    ).toEqual([]);
    expect(
      (
        await db
          .select({ action: platformAuditEvents.action })
          .from(platformAuditEvents)
          .where(eq(platformAuditEvents.targetId, person.user.id))
      ).map((row) => row.action),
    ).toContain("user.two_factor_reset");
  });

  it("is only for platform operators", async () => {
    const org = await world.org("Not an operator Co");
    const owner = await world.userIn(org, "owner", "Org Owner");
    const victim = await world.userIn(org, "member", "Victim");
    const caller = await world.caller(owner.user, org);

    await expect(
      caller.platform.users.resetTwoFactor({ userId: victim.user.id }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/FORBIDDEN|UNAUTHORIZED|NOT_FOUND/),
    });
  });
});
