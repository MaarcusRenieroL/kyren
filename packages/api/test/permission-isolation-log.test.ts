import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg, type TestUser } from "./helpers";
import {
  type Caller,
  forbidden,
  notFound,
} from "./helpers/permission-helpers";

const world = new World();
afterAll(() => world.cleanup());

describe("tenant isolation of roles, assignments, overrides and the log", () => {
  let orgA: TestOrg;
  let orgB: TestOrg;
  let asA: Caller;
  let userB: TestUser;
  let roleB: { id: string };

  beforeAll(async () => {
    orgA = await world.org("Iso A");
    orgB = await world.org("Iso B");
    asA = await world.caller((await world.userIn(orgA, "owner")).user, orgA);
    userB = (await world.userIn(orgB, "member", "Bee")).user;
    roleB = await world.role(orgB, {
      name: "Secret role",
      permissions: ["tasks.view"],
    });
    await world.assign(
      orgB,
      roleB.id,
      { type: "user", id: userB.id },
      { type: "organization", id: orgB.id },
    );
    await world.override(orgB, userB, "docs.view", "deny");
  });

  it("does not list another organization's roles, assignments, overrides or log", async () => {
    const list = await asA.permissions.roles.list();

    expect(list.map((role) => role.id)).not.toContain(roleB.id);
    expect(list.every((role) => role.name !== "Secret role")).toBe(true);
    await expect(
      asA.permissions.assignments.list({ userId: userB.id }),
    ).resolves.toEqual([]);
    await expect(
      asA.permissions.overrides.list({ userId: userB.id }),
    ).resolves.toEqual([]);

    const log = await asA.permissions.log.list();

    expect(log.items.every((item) => item.targetId !== userB.id)).toBe(true);
  });

  it("cannot read, change or assign another organization's roles", async () => {
    await expect(
      asA.permissions.roles.get({ id: roleB.id }),
    ).rejects.toMatchObject(notFound);
    await expect(
      asA.permissions.roles.update({ id: roleB.id, description: "x" }),
    ).rejects.toMatchObject(notFound);
    await expect(
      asA.permissions.roles.delete({ id: roleB.id }),
    ).rejects.toMatchObject(notFound);
    await expect(
      asA.permissions.assignments.assign({
        roleId: roleB.id,
        principalType: "user",
        principalId: userB.id,
        scopeType: "organization",
        scopeId: orgA.id,
      }),
    ).rejects.toMatchObject(notFound);
    await expect(
      asA.permissions.explain({ userId: userB.id, permission: "tasks.view" }),
    ).rejects.toMatchObject(notFound);
  });

  it("a role in one organization grants nothing in another", async () => {
    const mixed = (await world.userIn(orgB, "member", "Mixed")).user;

    await world.assign(
      orgB,
      roleB.id,
      { type: "user", id: mixed.id },
      { type: "organization", id: orgB.id },
    );

    // The same user is also a plain member of org A.
    await world.member(orgA, mixed, "member");

    const inA = (await world.caller(mixed, orgA)).permissions.me();

    expect((await inA).permissions["tasks.view"]).toBe(true); // from A's Member role, not B's
    expect((await inA).permissions["projects.create"]).toBe(false);
  });
});

describe("permission log", () => {
  it("records role, assignment and override changes with before and after", async () => {
    const org = await world.org("Logged");
    const owner = await world.caller(
      (await world.userIn(org, "owner")).user,
      org,
    );
    const target = (await world.userIn(org, "member", "Log Target")).user;

    const role = await owner.permissions.roles.create({
      name: "Logged role",
      scope: "organization",
      permissions: ["tasks.view"],
    });

    await owner.permissions.roles.update({
      id: role.id,
      permissions: ["tasks.view", "docs.view"],
    });

    const assignment = await owner.permissions.assignments.assign({
      roleId: role.id,
      principalType: "user",
      principalId: target.id,
      scopeType: "organization",
      scopeId: org.id,
    });

    await owner.permissions.overrides.set({
      userId: target.id,
      permission: "docs.view",
      effect: "deny",
      scopeType: "organization",
      scopeId: org.id,
      reason: "testing",
    });
    await owner.permissions.assignments.unassign({
      assignmentId: assignment.id,
    });

    const log = await owner.permissions.log.list();
    const actions = log.items.map((item) => item.action);

    expect(actions).toEqual(
      expect.arrayContaining([
        "role.created",
        "role.updated",
        "assignment.created",
        "override.set",
        "assignment.removed",
      ]),
    );

    const updated = log.items.find((item) => item.action === "role.updated")!;

    expect((updated.before as { permissions: string[] }).permissions).toEqual([
      "tasks.view",
    ]);
    expect((updated.after as { permissions: string[] }).permissions).toEqual([
      "tasks.view",
      "docs.view",
    ]);

    // Filtering by target.
    const forTarget = await owner.permissions.log.list({
      limit: 30,
      targetId: target.id,
    });

    expect(forTarget.items.every((item) => item.targetId === target.id)).toBe(
      true,
    );
  });

  it("has no procedure that updates or deletes log entries", async () => {
    const { appRouter } = await import("../src/server/root");
    const logProcedures = Object.keys(appRouter._def.procedures).filter(
      (path) => path.startsWith("permissions.log."),
    );

    expect(logProcedures).toEqual(["permissions.log.list"]);
  });

  it("restricts reading the log", async () => {
    const org = await world.org("Log access");
    const member = await world.caller(
      (await world.userIn(org, "member")).user,
      org,
    );
    const admin = await world.caller(
      (await world.userIn(org, "admin")).user,
      org,
    );

    await expect(member.permissions.log.list()).rejects.toMatchObject(
      forbidden,
    );
    await expect(admin.permissions.log.list()).resolves.toBeDefined();
  });
});
