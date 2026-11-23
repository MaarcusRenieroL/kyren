import { auth } from "@zentro/auth";
import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { organizations } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  featureEnabled,
  forgetOrganizationStatus,
} from "../src/server/platform-policy";
import { purgeScheduledOrganizations } from "../src/server/platform-purge";
import { auditActions, createOperator } from "./helpers/platform-helpers";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("tenant directory, suspension and inspection", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Awaited<ReturnType<World["userIn"]>>;
  let admin: Awaited<ReturnType<typeof createOperator>>;

  beforeAll(async () => {
    org = await world.org("Directory Co");
    owner = await world.userIn(org, "owner", "Dir Owner");
    admin = await createOperator(world);
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
    const admin = await createOperator(world);
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
      member.invitation.invite({
        email: `extra.${crypto.randomUUID()}@example.com`,
        role: "member",
      }),
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
    const platform = world.sessionCaller(await createOperator(world)).platform;

    await expect(
      platform.tenants.setFlags({ id: org.id, flags: { "Bad Name!": true } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

    const platform = world.sessionCaller(await createOperator(world)).platform;
    const dump = await platform.tenants.export({
      id: org.id,
      reason: "Customer asked for a copy",
    });

    expect(dump.organization.name).toBe("Export Co");
    expect(dump.people).toHaveLength(1);
    expect(Object.keys(dump.data)).toContain("project");
    expect(Object.keys(dump.data).join(" ")).not.toMatch(/api_?key|webhook/i);
    expect(JSON.stringify(dump.data)).not.toContain(inboxToken);
    expect(await auditActions(org.id)).toContain("tenant.exported");
  });

  it("schedules deletion, can cancel it, and purges after the grace period", async () => {
    const org = await world.org("Doomed Co");
    const owner = await world.userIn(org, "owner", "Doomed Owner");
    const platform = world.sessionCaller(await createOperator(world)).platform;

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

describe("closing the gaps", () => {
  it("refuses to accept an invitation past the seat limit", async () => {
    const org = await world.org("Seats Co");
    const owner = await world.userIn(org, "owner", "Seat Owner");
    const invitee = await world.user("Invitee");
    const platform = world.sessionCaller(await createOperator(world)).platform;

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

  it("lets a member read their organization's flags, and code check one", async () => {
    const org = await world.org("Flags Co");
    const owner = await world.userIn(org, "owner", "Flags Owner");
    const platform = world.sessionCaller(await createOperator(world)).platform;

    await expect(featureEnabled(db, org.id, "beta")).resolves.toBe(false);
    await platform.tenants.setFlags({ id: org.id, flags: { beta: true } });
    await expect(featureEnabled(db, org.id, "beta")).resolves.toBe(true);
    await expect(
      (await world.caller(owner.user, org)).organization.flags(),
    ).resolves.toEqual({ beta: true });
  });
});
