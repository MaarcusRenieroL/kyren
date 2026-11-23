import {
  auth,
  disabledOrganizationPaths,
  ensureSystemRoles,
} from "@kyren/auth";
import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { activityEvents, members, roles } from "@kyren/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";
import { notFound } from "./helpers/permission-helpers";

const world = new World();
const newPerson = `new.person.${crypto.randomUUID()}@example.test`;

afterAll(() => world.cleanup());

describe("explain, me and check", () => {
  it("explain reports the decision and its reasons for another user", async () => {
    const org = await world.org("Explain");
    const owner = await world.caller(
      (await world.userIn(org, "owner")).user,
      org,
    );
    const user = (await world.userIn(org, "member", "Exa Plain")).user;

    const allowed = await owner.permissions.explain({
      userId: user.id,
      permission: "tasks.create",
    });

    expect(allowed.allowed).toBe(true);
    expect(allowed.reasons[0]!.message).toContain("Member");

    await world.override(org, user, "tasks.create", "deny");

    const denied = await owner.permissions.explain({
      userId: user.id,
      permission: "tasks.create",
    });

    expect(denied.allowed).toBe(false);
    expect(denied.reasons[0]!.kind).toBe("override");
  });

  it("me reports base role and a permission map; check scopes to a project", async () => {
    const org = await world.org("Me");
    const { user } = await world.userIn(org, "member");
    const caller = await world.caller(user, org);
    const me = await caller.permissions.me();

    expect(me.baseRole).toBe("member");
    expect(me.permissions["tasks.create"]).toBe(true);
    expect(me.permissions["projects.create"]).toBe(false);

    const project = await world.project(org, { visibility: "private" });
    const scoped = await caller.permissions.check({ projectId: project.id });

    expect(scoped.permissions["tasks.view"]).toBe(false);
  });
});

describe("system roles", () => {
  it("are seeded idempotently under concurrent first access", async () => {
    const org = await world.org("Seeding");

    await Promise.all(
      Array.from({ length: 12 }, () => ensureSystemRoles(db, org.id)),
    );

    const rows = await db
      .select()
      .from(roles)
      .where(eq(roles.organizationId, org.id));

    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((role) => role.systemKey)).size).toBe(8);
  });

  it("are created on the first permission check", async () => {
    const org = await world.org("Lazy roles");
    const { user } = await world.userIn(org, "member");

    expect(
      await db.select().from(roles).where(eq(roles.organizationId, org.id)),
    ).toHaveLength(0);

    await (await world.caller(user, org)).permissions.me();

    expect(
      await db.select().from(roles).where(eq(roles.organizationId, org.id)),
    ).toHaveLength(8);
  });
});

describe("Better Auth endpoints cannot be called directly", () => {
  it("answers 404 for every disabled organization endpoint, even with a valid owner session", async () => {
    const org = await world.org("Direct calls");
    const { user } = await world.userIn(org, "owner");
    const headers = await world.sessionHeaders(user, org);

    headers.set("content-type", "application/json");

    for (const path of disabledOrganizationPaths) {
      for (const method of ["POST", "GET"]) {
        const response = await auth.handler(
          new Request(`http://localhost:3000/api/auth${path}`, {
            method,
            headers,
            body:
              method === "POST"
                ? JSON.stringify({ organizationId: org.id })
                : undefined,
          }),
        );

        expect(response.status, `${method} ${path}`).toBe(404);
      }
    }
  });

  it("members cannot invite, remove or re-role through the raw endpoints", async () => {
    const org = await world.org("Raw member");
    const member = await world.userIn(org, "member");
    const other = await world.userIn(org, "member");
    const headers = await world.sessionHeaders(member.user, org);

    headers.set("content-type", "application/json");

    const call = (path: string, body: unknown) =>
      auth.handler(
        new Request(`http://localhost:3000/api/auth${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
      );

    expect(
      (
        await call("/organization/invite-member", {
          email: "x@example.test",
          role: "admin",
          organizationId: org.id,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call("/organization/remove-member", {
          memberIdOrEmail: other.member.id,
          organizationId: org.id,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call("/organization/update-member-role", {
          memberId: other.member.id,
          role: "owner",
          organizationId: org.id,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call("/organization/update", {
          data: { name: "Hijacked" },
          organizationId: org.id,
        })
      ).status,
    ).toBe(404);
    expect(
      (await call("/organization/delete", { organizationId: org.id })).status,
    ).toBe(404);

    const [row] = await db
      .select()
      .from(members)
      .where(eq(members.id, other.member.id));

    expect(row?.role).toBe("member");
  });

  it("the tRPC procedures work for people who hold the permission", async () => {
    const org = await world.org("Via trpc");
    const owner = await world.caller(
      (await world.userIn(org, "owner")).user,
      org,
    );
    const admin = await world.caller(
      (await world.userIn(org, "admin")).user,
      org,
    );
    const member = await world.userIn(org, "member");
    const leaving = await world.userIn(org, "member");

    const invitation = await admin.invitation.invite({
      email: newPerson,
      role: "member",
    });

    expect(invitation.email).toBe(newPerson);
    await expect(
      admin.invitation.resend({ invitationId: invitation.id }),
    ).resolves.toBeDefined();
    await expect(
      admin.invitation.cancel({ invitationId: invitation.id }),
    ).resolves.toBeDefined();
    await expect(
      admin.member.updateRole({ memberId: member.member.id, role: "admin" }),
    ).resolves.toEqual({ memberId: member.member.id, role: "admin" });
    // An admin removes members; another admin only an owner removes.
    await expect(
      admin.member.remove({ memberId: leaving.member.id }),
    ).resolves.toBeDefined();
    await expect(
      admin.member.remove({ memberId: member.member.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.member.remove({ memberId: member.member.id }),
    ).resolves.toBeDefined();

    // Invitations of another organization are out of reach.
    const other = await world.org("Other invites");
    const otherOwner = await world.userIn(other, "owner");
    const foreign = await world.invitation(other, otherOwner.user, {
      email: "foreign@example.test",
    });

    await expect(
      admin.invitation.cancel({ invitationId: foreign.id }),
    ).rejects.toMatchObject(notFound);
    await expect(
      owner.invitation.resend({ invitationId: foreign.id }),
    ).rejects.toMatchObject(notFound);
    await expect(owner.invitation.list()).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: foreign.id })]),
    );
  });

  it("log rows exist for member removal", async () => {
    const org = await world.org("Removal log");
    const owner = await world.caller(
      (await world.userIn(org, "owner")).user,
      org,
    );
    const member = await world.userIn(org, "member");

    await owner.member.remove({ memberId: member.member.id });

    const rows = await db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.organizationId, org.id));

    expect(rows.map((row) => row.action)).toContain("member.removed");
  });
});
