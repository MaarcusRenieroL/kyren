import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fetchEvents as events } from "./helpers/activity-recording-helpers";
import { World, type TestOrg, type TestUser } from "./helpers";

const world = new World();
const newPerson = `new.person.${crypto.randomUUID()}@example.test`;

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("events are recorded for admin mutations", () => {
  let org: TestOrg;
  let owner: Caller;
  let memberUser: TestUser;
  let memberId: string;
  let projectId: string;

  beforeAll(async () => {
    org = await world.org("Rec-Admin");
    const o = await world.userIn(org, "owner", "Olive Owner");
    const m = await world.userIn(org, "member", "Max Member");

    memberUser = m.user;
    memberId = m.member.id;
    owner = await world.caller(o.user, org);

    const project = await owner.project.createProject({
      name: "Atlas",
      slug: "atlas",
      description: "",
    });

    projectId = project.id;
  });

  it("records role, assignment and override changes", async () => {
    const role = await owner.permissions.roles.create({
      name: "Reviewer",
      scope: "organization",
      permissions: ["tasks.view"],
    });

    await owner.permissions.roles.update({
      id: role.id,
      permissions: ["tasks.view", "docs.view"],
    });

    const [updated] = await events(org, "role.updated");

    expect(updated!.metadata).toMatchObject({
      addedPermissions: ["docs.view"],
      removedPermissions: [],
    });

    const clone = await owner.permissions.roles.clone({
      id: role.id,
      name: "Reviewer copy",
    });

    await owner.permissions.roles.delete({ id: clone.id });
    await owner.permissions.roles.resetSystem({ systemKey: "member" });

    for (const action of [
      "role.created",
      "role.cloned",
      "role.deleted",
      "role.reset",
    ]) {
      expect((await events(org, action))[0], action).toMatchObject({
        auditOnly: true,
        targetType: "role",
      });
    }

    const viewer = await owner.permissions.roles.list();
    const projectViewer = viewer.find(
      (item) => item.systemKey === "project_viewer",
    )!;
    const assignment = await owner.permissions.assignments.assign({
      roleId: projectViewer.id,
      principalType: "user",
      principalId: memberUser.id,
      scopeType: "project",
      scopeId: projectId,
    });

    expect(
      (await events(org, "assignment.created")).some(
        (event) => event.targetId === assignment.id,
      ),
    ).toBe(true);
    expect((await events(org, "project.member_added"))[0]).toMatchObject({
      projectId,
      auditOnly: true,
    });

    await owner.permissions.assignments.unassign({
      assignmentId: assignment.id,
    });
    expect(await events(org, "assignment.removed")).toHaveLength(1);
    expect(await events(org, "project.member_removed")).toHaveLength(1);

    const override = await owner.permissions.overrides.set({
      userId: memberUser.id,
      permission: "tasks.assign",
      effect: "deny",
      scopeType: "organization",
      scopeId: org.id,
      reason: "Probation",
    });

    expect((await events(org, "override.set"))[0]!.metadata).toMatchObject({
      permission: "tasks.assign",
      effect: "deny",
      reason: "Probation",
    });

    await owner.permissions.overrides.remove({ id: override.id });
    expect(await events(org, "override.removed")).toHaveLength(1);
  });

  it("records modules, members, invitations and ownership", async () => {
    await owner.modules.setEnabled({ moduleId: "docs", enabled: false });
    await owner.modules.setEnabled({ moduleId: "docs", enabled: false });
    await owner.modules.setEnabled({ moduleId: "docs", enabled: true });

    expect((await events(org, "module.disabled"))[0]).toMatchObject({
      targetType: "module",
      targetId: "docs",
      targetLabel: "Docs",
    });
    expect(await events(org, "module.disabled")).toHaveLength(1);
    expect(await events(org, "module.enabled")).toHaveLength(1);

    const invitation = await owner.invitation.invite({
      email: newPerson,
      role: "member",
    });

    await owner.invitation.resend({ invitationId: invitation.id });
    await owner.invitation.cancel({ invitationId: invitation.id });

    for (const action of [
      "invitation.sent",
      "invitation.resent",
      "invitation.cancelled",
    ]) {
      expect((await events(org, action))[0], action).toMatchObject({
        targetId: invitation.id,
        targetLabel: newPerson,
        auditOnly: true,
      });
    }

    await owner.member.updateRole({ memberId, role: "admin" });
    expect(
      (await events(org, "member.role_updated"))[0]!.metadata.changes,
    ).toEqual([{ field: "role", from: "member", to: "admin" }]);

    await owner.member.transferOwnership({ memberId });
    expect((await events(org, "org.ownership_transferred"))[0]).toMatchObject({
      targetId: memberId,
      targetLabel: "Max Member",
    });
  });

  it("records the organization update and member removal", async () => {
    const solo = await world.org("Solo");
    const a = await world.userIn(solo, "owner", "Ann Owner");
    const b = await world.userIn(solo, "member", "Bob Member");
    const as = await world.caller(a.user, solo);

    await as.organization.update({ name: "Solo renamed" });
    await as.member.remove({ memberId: b.member.id });

    expect((await events(solo, "org.updated"))[0]!.metadata.changes).toEqual([
      { field: "name", from: "Solo", to: "Solo renamed" },
    ]);
    expect((await events(solo, "member.removed"))[0]).toMatchObject({
      targetId: b.member.id,
      targetLabel: "Bob Member",
      auditOnly: true,
    });

    await as.organization.delete();
    expect(await events(solo)).toHaveLength(0);
  });

  it("records the audit export", async () => {
    const result = await owner.audit.export({ actionPrefix: "task." });
    const [exported] = await events(org, "audit.exported");

    expect(exported).toMatchObject({ auditOnly: true, targetType: "audit" });
    expect(exported!.metadata).toMatchObject({
      filter: { actionPrefix: "task." },
      rowCount: result.rowCount,
    });
  });
});
