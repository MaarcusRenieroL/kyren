import { db } from "@kyren/db";
import { and, eq } from "@kyren/db/drizzle";
import { members } from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg, type TestUser } from "./helpers";
import {
  type Caller,
  forbidden,
} from "./helpers/permission-helpers";

const world = new World();
afterAll(() => world.cleanup());

describe("immutability and lockout rules", () => {
  let org: TestOrg;
  let owner: Caller;
  let ownerUser: TestUser;
  let admin: Caller;
  let adminUser: TestUser;
  let target: TestUser;

  beforeAll(async () => {
    org = await world.org("Lockout");
    const o = await world.userIn(org, "owner", "Eve Owner");
    const a = await world.userIn(org, "admin", "Abe Admin");

    ownerUser = o.user;
    adminUser = a.user;
    owner = await world.caller(o.user, org);
    admin = await world.caller(a.user, org);
    target = (await world.userIn(org, "member", "Tom Target")).user;
  });

  it("the Owner role is immutable and system roles keep their names", async () => {
    const all = await owner.permissions.roles.list();
    const ownerRole = all.find((role) => role.systemKey === "owner")!;
    const adminRole = all.find((role) => role.systemKey === "admin")!;

    await expect(
      owner.permissions.roles.update({ id: ownerRole.id, permissions: [] }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      owner.permissions.roles.update({ id: adminRole.id, name: "Boss" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      owner.permissions.roles.delete({ id: adminRole.id }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      owner.permissions.roles.update({
        id: all.find((role) => role.systemKey === "project_lead")!.id,
        description: "x",
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("Admin and Member can be edited and reset to their defaults", async () => {
    const all = await owner.permissions.roles.list();
    const memberRole = all.find((role) => role.systemKey === "member")!;
    const defaults = memberRole.permissions;

    await owner.permissions.roles.update({
      id: memberRole.id,
      permissions: defaults.filter((key) => key !== "tasks.delete_any"),
    });

    const edited = await owner.permissions.roles.get({ id: memberRole.id });

    expect(edited.permissions).not.toContain("tasks.delete_any");

    const reset = await owner.permissions.roles.resetSystem({
      systemKey: "member",
    });

    expect([...reset.permissions].sort()).toEqual([...defaults].sort());
  });

  it("an assigned custom role cannot be deleted until it is unassigned", async () => {
    const role = await world.role(org, {
      name: "Assigned role",
      permissions: ["tasks.view"],
    });
    const assignment = await owner.permissions.assignments.assign({
      roleId: role.id,
      principalType: "user",
      principalId: target.id,
      scopeType: "organization",
      scopeId: org.id,
    });

    await expect(
      owner.permissions.roles.delete({ id: role.id }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("assigned 1 time"),
    });

    await owner.permissions.assignments.unassign({
      assignmentId: assignment.id,
    });
    await expect(
      owner.permissions.roles.delete({ id: role.id }),
    ).resolves.toBeDefined();
  });

  it("base roles cannot be assigned like custom roles, and scopes must match", async () => {
    const all = await owner.permissions.roles.list();

    await expect(
      owner.permissions.assignments.assign({
        roleId: all.find((role) => role.systemKey === "admin")!.id,
        principalType: "user",
        principalId: target.id,
        scopeType: "organization",
        scopeId: org.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.permissions.assignments.assign({
        roleId: all.find((role) => role.systemKey === "project_viewer")!.id,
        principalType: "user",
        principalId: target.id,
        scopeType: "organization",
        scopeId: org.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("owners cannot be demoted or removed, and only an owner transfers ownership", async () => {
    const [ownerMember] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.userId, ownerUser.id),
          eq(members.organizationId, org.id),
        ),
      );

    await expect(
      admin.member.updateRole({ memberId: ownerMember!.id, role: "member" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      admin.member.remove({ memberId: ownerMember!.id }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      owner.member.remove({ memberId: ownerMember!.id }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      owner.member.updateRole({ memberId: ownerMember!.id, role: "admin" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      admin.member.transferOwnership({ memberId: ownerMember!.id }),
    ).rejects.toMatchObject(forbidden);
  });

  it("cannot change your own base role or remove yourself", async () => {
    const [adminMember] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.userId, adminUser.id),
          eq(members.organizationId, org.id),
        ),
      );

    await expect(
      admin.member.updateRole({ memberId: adminMember!.id, role: "member" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      admin.member.remove({ memberId: adminMember!.id }),
    ).rejects.toMatchObject(forbidden);
  });

  it("removing a member clears their access", async () => {
    const leaving = (await world.userIn(org, "member", "Lee Leaving")).user;
    const role = await world.role(org, {
      name: "Leaving role",
      permissions: ["tasks.view"],
    });
    const [row] = await db
      .select()
      .from(members)
      .where(
        and(eq(members.userId, leaving.id), eq(members.organizationId, org.id)),
      );

    await world.assign(
      org,
      role.id,
      { type: "user", id: leaving.id },
      { type: "organization", id: org.id },
    );
    await world.override(org, leaving, "docs.view", "allow");
    await admin.member.remove({ memberId: row!.id });

    const remaining = await owner.permissions.assignments.list({
      userId: leaving.id,
    });
    const overrides = await owner.permissions.overrides.list({
      userId: leaving.id,
    });

    expect(remaining).toEqual([]);
    expect(overrides).toEqual([]);
  });

  it("ownership transfer makes the target owner and the caller admin", async () => {
    const newOwner = (await world.userIn(org, "member", "Nina New")).user;
    const [row] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.userId, newOwner.id),
          eq(members.organizationId, org.id),
        ),
      );

    await owner.member.transferOwnership({ memberId: row!.id });

    const memberRoles = await db
      .select({ userId: members.userId, role: members.role })
      .from(members)
      .where(eq(members.organizationId, org.id));

    expect(memberRoles.find((m) => m.userId === newOwner.id)?.role).toBe("owner");
    expect(memberRoles.find((m) => m.userId === ownerUser.id)?.role).toBe("admin");
  });
});
