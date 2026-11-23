import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { members, roles } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg, type TestUser } from "./helpers";
import {
  type Caller,
  expectAllowed,
  forbidden,
} from "./helpers/permission-helpers";

const world = new World();
afterAll(() => world.cleanup());

describe("escalation rules", () => {
  let org: TestOrg;
  let owner: Caller;
  let ownerUser: TestUser;
  let admin: Caller;
  let helper: TestUser;
  let helperCaller: Caller;
  let target: TestUser;

  beforeAll(async () => {
    org = await world.org("Escalation");
    const o = await world.userIn(org, "owner", "Eve Owner");
    const a = await world.userIn(org, "admin", "Abe Admin");

    ownerUser = o.user;
    owner = await world.caller(o.user, org);
    admin = await world.caller(a.user, org);
    target = (await world.userIn(org, "member", "Tom Target")).user;

    // Someone who may manage roles but holds little else.
    helper = (await world.userIn(org, "member", "Hal Helper")).user;
    const manager = await world.role(org, {
      name: "Role manager",
      permissions: [
        "roles.view",
        "roles.create",
        "roles.update",
        "roles.delete",
        "roles.assign",
        "permissions.overrides.manage",
        "members.role.update",
        "members.invite",
        "members.view",
        "tasks.view",
      ],
    });

    await world.assign(
      org,
      manager.id,
      { type: "user", id: helper.id },
      { type: "organization", id: org.id },
    );
    helperCaller = await world.caller(helper, org);
  });

  it("cannot create a role with permissions the caller does not hold", async () => {
    await expect(
      helperCaller.permissions.roles.create({
        name: "Too much",
        scope: "organization",
        permissions: ["projects.delete"],
      }),
    ).rejects.toMatchObject(forbidden);
    await expectAllowed(
      helperCaller.permissions.roles.create({
        name: "Fits",
        scope: "organization",
        permissions: ["tasks.view"],
      }),
    );
  });

  it("cannot grant owner-only or scope-invalid permissions in a role", async () => {
    await expect(
      owner.permissions.roles.create({
        name: "Owner stuff",
        scope: "organization",
        permissions: ["org.delete"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.permissions.roles.create({
        name: "Bad scope",
        scope: "team",
        permissions: ["projects.create"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.permissions.roles.create({
        name: "Unknown",
        scope: "organization",
        permissions: ["nope.nothing"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cannot edit a role that contains permissions the caller does not hold", async () => {
    const strong = await world.role(org, {
      name: "Strong",
      permissions: ["projects.delete", "tasks.view"],
    });

    await expect(
      helperCaller.permissions.roles.update({
        id: strong.id,
        description: "x",
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      helperCaller.permissions.assignments.assign({
        roleId: strong.id,
        principalType: "user",
        principalId: target.id,
        scopeType: "organization",
        scopeId: org.id,
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("cannot change your own roles or overrides", async () => {
    const [anyRole] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.organizationId, org.id), eq(roles.name, "Fits")));

    await expect(
      helperCaller.permissions.assignments.assign({
        roleId: anyRole!.id,
        principalType: "user",
        principalId: helper.id,
        scopeType: "organization",
        scopeId: org.id,
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      helperCaller.permissions.overrides.set({
        userId: helper.id,
        permission: "tasks.view",
        effect: "allow",
        scopeType: "organization",
        scopeId: org.id,
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("cannot modify an owner", async () => {
    const [anyRole] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.organizationId, org.id), eq(roles.name, "Fits")));

    await expect(
      helperCaller.permissions.assignments.assign({
        roleId: anyRole!.id,
        principalType: "user",
        principalId: ownerUser.id,
        scopeType: "organization",
        scopeId: org.id,
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      admin.permissions.overrides.set({
        userId: ownerUser.id,
        permission: "tasks.view",
        effect: "deny",
        scopeType: "organization",
        scopeId: org.id,
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("cannot allow a permission the caller does not hold", async () => {
    await expect(
      helperCaller.permissions.overrides.set({
        userId: target.id,
        permission: "projects.delete",
        effect: "allow",
        scopeType: "organization",
        scopeId: org.id,
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("cannot promote someone to a role the caller does not fully hold", async () => {
    const [targetMember] = await db
      .select()
      .from(members)
      .where(
        and(eq(members.userId, target.id), eq(members.organizationId, org.id)),
      );

    await expect(
      helperCaller.member.updateRole({
        memberId: targetMember!.id,
        role: "admin",
      }),
    ).rejects.toMatchObject(forbidden);
  });
});
