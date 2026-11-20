import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import {
  files,
  jobs,
  organizations,
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
  forgetOrganizationStatus,
  forgetPlatformIpPolicy,
} from "../src/server/platform-policy";
import { purgeScheduledOrganizations } from "../src/server/platform-purge";
import { featureEnabled } from "../src/server/platform-policy";
import { auth } from "@zentro/auth";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

async function operator() {
  const created = await world.user("Operator");

  await db
    .update(users)
    .set({ role: "platform_admin", twoFactorEnabled: true })
    .where(eq(users.id, created.id));

  const [row] = await db.select().from(users).where(eq(users.id, created.id));

  return row!;
}

async function auditActions(organizationId: string) {
  const rows = await db
    .select({ action: platformAuditEvents.action })
    .from(platformAuditEvents)
    .where(eq(platformAuditEvents.organizationId, organizationId));

  return rows.map((row) => row.action);
}

afterEach(async () => {
  await db.delete(platformSettings);
  await db.delete(platformIpAllowlist);
  await db.delete(platformAnnouncements);
  forgetMaintenance();
  forgetPlatformIpPolicy();
});

describe("tenant directory, suspension and inspection", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Awaited<ReturnType<World["userIn"]>>;
  let admin: Awaited<ReturnType<typeof operator>>;

  beforeAll(async () => {
    org = await world.org("Directory Co");
    owner = await world.userIn(org, "owner", "Dir Owner");
    admin = await operator();
  });

  it("lists and searches organizations", async () => {
    const platform = world.sessionCaller(admin).platform;
    const found = await platform.tenants.list({ search: "Directory Co" });

    expect(found.rows.map((row) => row.id)).toContain(org.id);
    expect(found.rows.find((row) => row.id === org.id)?.members).toBe(1);
    await expect(
      platform.tenants.list({ search: "no-such-tenant-zzz" }),
    ).resolves.toMatchObject({ total: 0 });
  });

  it("suspends and reactivates, blocking the organization's own calls", async () => {
    const platform = world.sessionCaller(admin).platform;
    const member = await world.caller(owner.user, org);

    await expect(member.apiKey.list()).resolves.toEqual([]);

    await platform.tenants.suspend({ id: org.id, reason: "Unpaid invoice" });
    await expect(member.apiKey.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/suspended.*Unpaid invoice/i),
    });

    await platform.tenants.reactivate({ id: org.id });
    await expect(member.apiKey.list()).resolves.toEqual([]);
    expect(await auditActions(org.id)).toEqual(
      expect.arrayContaining(["tenant.suspended", "tenant.reactivated"]),
    );
  });

  it("inspects read-only, needs a reason and logs the look", async () => {
    const platform = world.sessionCaller(admin).platform;

    await expect(
      platform.tenants.inspect({ id: org.id, reason: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const view = await platform.tenants.inspect({
      id: org.id,
      reason: "Support ticket 1234",
    });

    expect(view.people.map((person) => person.email)).toContain(
      owner.user.email,
    );
    expect(await auditActions(org.id)).toContain("tenant.inspected");
  });

  it("refuses ordinary members every platform call", async () => {
    await expect(
      world.sessionCaller(owner.user).platform.tenants.list({}),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("flags, limits and seats", () => {
  it("records flags and caps the member count", async () => {
    const org = await world.org("Limited Co");
    const owner = await world.userIn(org, "owner", "Limit Owner");
    const admin = await operator();
    const platform = world.sessionCaller(admin).platform;

    await platform.tenants.setFlags({
      id: org.id,
      flags: { beta_search: true },
    });
    await platform.tenants.setLimits({ id: org.id, members: 1, storageMb: 5 });

    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, org.id));

    expect(row?.featureFlags).toEqual({ beta_search: true });
    expect(row?.limits).toEqual({ members: 1, storageMb: 5 });

    const member = await world.caller(owner.user, org);

    await expect(
      member.invitation.invite({ email: "extra@example.com", role: "member" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/allows 1 members/i),
    });
    await expect(member.files.usage()).resolves.toMatchObject({
      limit: 5 * 1024 * 1024,
    });
  });

  it("rejects badly named flags", async () => {
    const org = await world.org("Flag Co");
    const platform = world.sessionCaller(await operator()).platform;

    await expect(
      platform.tenants.setFlags({ id: org.id, flags: { "Bad Name!": true } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("maintenance mode", () => {
  it("makes everything read-only except the console, and ends cleanly", async () => {
    const org = await world.org("Maintenance Co");
    const owner = await world.userIn(org, "owner", "Maint Owner");
    const platform = world.sessionCaller(await operator()).platform;
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
    const admin = await operator();
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
    const admin = await operator();
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
    const admin = await operator();
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
    const platform = world.sessionCaller(await operator()).platform;
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

describe("export and deletion with a grace period", () => {
  it("exports the organization without secrets and logs it", async () => {
    const org = await world.org("Export Co");
    const exportOwner = await world.userIn(org, "owner", "Export Owner");
    const inboxToken = (
      await (
        await world.caller(exportOwner.user, org)
      ).tickets.setInbox({
        enabled: true,
      })
    ).token!;

    const platform = world.sessionCaller(await operator()).platform;
    const dump = await platform.tenants.export({
      id: org.id,
      reason: "Customer asked for a copy",
    });

    expect(dump.organization.name).toBe("Export Co");
    expect(dump.people).toHaveLength(1);
    expect(Object.keys(dump.data)).toContain("project");
    expect(Object.keys(dump.data).join(" ")).not.toMatch(/api_?key|webhook/i);
    // Working link tokens in ordinary tables never leave either.
    expect(JSON.stringify(dump.data)).not.toContain(inboxToken);
    expect(await auditActions(org.id)).toContain("tenant.exported");
  });

  it("schedules deletion, can cancel it, and purges after the grace period", async () => {
    const org = await world.org("Doomed Co");
    const owner = await world.userIn(org, "owner", "Doomed Owner");
    const platform = world.sessionCaller(await operator()).platform;

    await expect(
      platform.tenants.requestDeletion({ id: org.id, confirmSlug: "wrong" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const { scheduledFor } = await platform.tenants.requestDeletion({
      id: org.id,
      confirmSlug: org.slug,
    });

    expect(scheduledFor.getTime()).toBeGreaterThan(
      Date.now() + 13 * 86_400_000,
    );
    await expect(
      (await world.caller(owner.user, org)).apiKey.list(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await platform.tenants.cancelDeletion({ id: org.id });
    forgetOrganizationStatus(org.id);
    await expect(
      (await world.caller(owner.user, org)).apiKey.list(),
    ).resolves.toEqual([]);

    await platform.tenants.requestDeletion({
      id: org.id,
      confirmSlug: org.slug,
    });
    await expect(purgeScheduledOrganizations(db)).resolves.toBe(0);

    await db
      .update(organizations)
      .set({ deletionScheduledFor: new Date(Date.now() - 1000) })
      .where(eq(organizations.id, org.id));
    await expect(purgeScheduledOrganizations(db)).resolves.toBe(1);

    const left = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, org.id));

    expect(left).toEqual([]);
    expect(await auditActions(org.id)).toEqual(
      expect.arrayContaining(["tenant.deletion_requested", "tenant.purged"]),
    );
  });
});

describe("user lookup, forced sign-out and password reset", () => {
  it("finds a user across organizations and ends their sessions", async () => {
    const org = await world.org("Lookup Co");
    const member = await world.userIn(org, "member", "Findable Person");
    const platform = world.sessionCaller(await operator()).platform;

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
    const platform = world.sessionCaller(await operator()).platform;

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

describe("closing the gaps", () => {
  it("refuses to accept an invitation past the seat limit", async () => {
    const org = await world.org("Seats Co");
    const owner = await world.userIn(org, "owner", "Seat Owner");
    const invitee = await world.user("Invitee");
    const platform = world.sessionCaller(await operator()).platform;

    await platform.tenants.setLimits({
      id: org.id,
      members: 1,
      storageMb: null,
    });

    const invitation = await world.invitation(org, owner.user, {
      email: invitee.email,
    });

    await expect(
      auth.api.acceptInvitation({
        headers: await world.sessionHeaders(invitee),
        body: { invitationId: invitation.id },
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/reached its limit of 1/i),
    });

    await platform.tenants.setLimits({
      id: org.id,
      members: 2,
      storageMb: null,
    });
    await expect(
      auth.api.acceptInvitation({
        headers: await world.sessionHeaders(invitee),
        body: { invitationId: invitation.id },
      }),
    ).resolves.toBeTruthy();
  });

  it("removes the uploaded bytes of a purged organization", async () => {
    const org = await world.org("Files Co");
    const owner = await world.userIn(org, "owner", "Files Owner");
    const removed: string[] = [];

    await db.insert(files).values({
      organizationId: org.id,
      uploadedByMemberId: owner.member.id,
      name: "a.png",
      mimeType: "image/png",
      size: 10,
      storageKey: `${org.id}/a.png`,
    });
    await db
      .update(organizations)
      .set({ deletionScheduledFor: new Date(Date.now() - 1000) })
      .where(eq(organizations.id, org.id));

    await expect(
      purgeScheduledOrganizations(db, {
        removeFiles: async (keys) => {
          removed.push(...keys);
        },
      }),
    ).resolves.toBe(1);
    expect(removed).toEqual([`${org.id}/a.png`]);
  });

  it("still purges when removing the bytes fails", async () => {
    const org = await world.org("Flaky Files Co");

    await db
      .update(organizations)
      .set({ deletionScheduledFor: new Date(Date.now() - 1000) })
      .where(eq(organizations.id, org.id));
    await world.userIn(org, "owner", "Flaky Owner");

    await expect(
      purgeScheduledOrganizations(db, {
        removeFiles: async () => {
          throw new Error("storage down");
        },
      }),
    ).resolves.toBe(1);
  });

  it("lets a member read their organization's flags, and code check one", async () => {
    const org = await world.org("Flags Co");
    const owner = await world.userIn(org, "owner", "Flags Owner");
    const platform = world.sessionCaller(await operator()).platform;

    await expect(featureEnabled(db, org.id, "beta")).resolves.toBe(false);
    await platform.tenants.setFlags({ id: org.id, flags: { beta: true } });
    await expect(featureEnabled(db, org.id, "beta")).resolves.toBe(true);
    await expect(
      (await world.caller(owner.user, org)).organization.flags(),
    ).resolves.toEqual({ beta: true });
  });
});
