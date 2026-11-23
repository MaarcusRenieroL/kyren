import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { roles } from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("what lists of roles and assignments reveal", () => {
  let auditor: Caller;
  let admin: Caller;
  let org: TestOrg;
  let projectName: string;
  let projectId: string;

  beforeAll(async () => {
    org = await world.org("Role lists");
    await world.userIn(org, "owner", "Rhea Owner");
    const adminU = await world.userIn(org, "admin", "Ada Admin");
    const audit = await world.userIn(org, "member", "Audrey Auditor");
    const target = await world.userIn(org, "member", "Tom Target");
    const hidden = await world.project(org, {
      visibility: "private",
      name: "Secret Skunkworks",
    });

    projectName = hidden.name;
    projectId = hidden.id;

    await world.assign(
      org,
      await world.systemRoleId(org, "project_member"),
      { type: "user", id: target.user.id },
      { type: "project", id: hidden.id },
    );
    await world.override(org, target.user, "tasks.assign", "deny", {
      type: "project",
      id: hidden.id,
    });

    const viewer = await world.role(org, {
      name: "Role viewer",
      permissions: ["roles.view"],
    });

    await world.assign(
      org,
      viewer.id,
      { type: "user", id: audit.user.id },
      { type: "organization", id: org.id },
    );

    auditor = await world.caller(audit.user, org);
    admin = await world.caller(adminU.user, org);
  });

  it("an admin sees assignments and overrides on every project", async () => {
    const assignments = await admin.permissions.assignments.list();
    const overrides = await admin.permissions.overrides.list();

    expect(assignments.some((row) => row.scopeName === projectName)).toBe(true);
    expect(overrides.some((row) => row.scopeId === projectId)).toBe(true);
  });

  it("someone who can view roles but not the project does not learn about it", async () => {
    const assignments = await auditor.permissions.assignments.list();
    const overrides = await auditor.permissions.overrides.list();

    expect(JSON.stringify(assignments)).not.toContain(projectName);
    expect(assignments.some((row) => row.scopeId === projectId)).toBe(false);
    expect(overrides.some((row) => row.scopeId === projectId)).toBe(false);
  });
});

describe("project counts follow what the caller may see", () => {
  it("hide task and doc counts, and the headcount, from limited roles", async () => {
    const org = await world.org("Counts");
    const owner = await world.userIn(org, "owner", "Cora Owner");
    const limited = await world.userIn(org, "member", "Lee Limited");
    const other = await world.userIn(org, "member", "Olly Other");
    const project = await world.project(org, { taskKeyPrefix: "CT" });

    await world.task(org, project, {
      taskNumber: 1,
      createdByMemberId: owner.member.id,
    });
    await world.doc(org, {
      projectId: project.id,
      createdByMemberId: owner.member.id,
    });

    const role = await world.role(org, {
      name: "Look only",
      scope: "project",
      permissions: ["projects.view"],
    });

    await world.assign(
      org,
      role.id,
      { type: "user", id: limited.user.id },
      { type: "project", id: project.id },
    );
    await world.assign(
      org,
      role.id,
      { type: "user", id: other.user.id },
      { type: "project", id: project.id },
    );

    // Take everything but project viewing away from the Member role.
    await db
      .update(roles)
      .set({ permissions: ["projects.view"] })
      .where(eq(roles.id, await world.systemRoleId(org, "member")));

    const ownerView = await (
      await world.caller(owner.user, org)
    ).project.getProjectBySlug({ slug: project.slug });
    const limitedView = await (
      await world.caller(limited.user, org)
    ).project.getProjectBySlug({ slug: project.slug });

    expect(ownerView).toMatchObject({
      totalTasks: 1,
      totalDocs: 1,
      totalMembers: 3,
    });
    expect(limitedView).toMatchObject({
      totalTasks: 0,
      openTasks: 0,
      totalDocs: 0,
      totalMembers: 2,
    });
  });
});
