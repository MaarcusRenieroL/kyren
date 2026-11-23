import { ensureSystemRoles } from "@zentro/auth";
import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { projects, roles } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg, type TestUser } from "./helpers";
import {
  type Caller,
  expectAllowed,
  forbidden,
} from "./helpers/permission-helpers";

const world = new World();
afterAll(() => world.cleanup());

describe("custom roles, project roles and overrides: project roles", () => {
  let org: TestOrg;
  let restricted: TestUser;
  let projectId: string;
  let projectSlug: string;
  let otherProjectSlug: string;

  beforeAll(async () => {
    org = await world.org("RestrictedProj");
    await world.caller((await world.userIn(org, "owner")).user, org);
    restricted = (await world.userIn(org, "member", "Restricted Rita")).user;

    // The base Member role grants nothing but project viewing.
    await ensureSystemRoles(db, org.id);
    await db
      .update(roles)
      .set({ permissions: ["projects.view"] })
      .where(
        and(eq(roles.organizationId, org.id), eq(roles.systemKey, "member")),
      );

    const project = await world.project(org, { taskKeyPrefix: "RS" });
    const other = await world.project(org, { taskKeyPrefix: "RT" });

    projectId = project.id;
    projectSlug = project.slug;
    otherProjectSlug = other.slug;
    await world.task(org, project, { taskNumber: 1, name: "Scoped task" });
    await world.task(org, other, { taskNumber: 1, name: "Other task" });
  });

  it("a member with a trimmed Member role has no task access by default", async () => {
    const caller = await world.caller(restricted, org);

    await expect(caller.task.getTasksByOrgId({})).resolves.toEqual([]);
    await expect(
      caller.task.createTask({ projectId, name: "Nope" }),
    ).rejects.toMatchObject(forbidden);
  });

  it("a project viewer reads inside the project and nothing else", async () => {
    const viewerRole = await world.systemRoleId(org, "project_viewer");

    await world.assign(
      org,
      viewerRole,
      { type: "user", id: restricted.id },
      { type: "project", id: projectId },
    );

    const caller = await world.caller(restricted, org);
    const tasks = await caller.task.getTasksByOrgId({});

    expect(tasks.map((task) => task.key)).toEqual(["RS-1"]);
    await expectAllowed(caller.task.getTaskByKey({ key: "RS-1" }));
    await expect(
      caller.task.createTask({ projectId, name: "Viewer write" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      caller.task.updateTaskByKey({ key: "RS-1", name: "x" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      caller.comment.createTaskComment({ taskKey: "RS-1", body: "x" }),
    ).rejects.toMatchObject(forbidden);
  });

  it("a project member can create and edit tasks in that project only", async () => {
    const memberRole = await world.systemRoleId(org, "project_member");
    const user = (await world.userIn(org, "member", "Pat Project")).user;

    await world.assign(
      org,
      memberRole,
      { type: "user", id: user.id },
      { type: "project", id: projectId },
    );

    const caller = await world.caller(user, org);
    const created = await caller.task.createTask({
      projectId,
      name: "Project member task",
    });

    await expectAllowed(
      caller.task.updateTaskByKey({ key: created.key, status: "review" }),
    );
    await expect(
      caller.task.updateTaskByKey({ key: "RT-1", name: "elsewhere" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      caller.project.updateProjectBySlug({
        currentSlug: projectSlug,
        name: "x",
        slug: projectSlug,
        description: "",
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("a project lead can update the project and manage its members", async () => {
    const leadRole = await world.systemRoleId(org, "project_lead");
    const lead = (await world.userIn(org, "member", "Lena Lead")).user;
    const pal = (await world.userIn(org, "member", "Pal Person")).user;

    await world.assign(
      org,
      leadRole,
      { type: "user", id: lead.id },
      { type: "project", id: projectId },
    );

    const caller = await world.caller(lead, org);

    await expectAllowed(
      caller.project.updateProjectBySlug({
        currentSlug: projectSlug,
        name: "Led project",
        slug: projectSlug,
        description: "",
      }),
    );
    await expect(
      caller.project.deleteProject({ slug: projectSlug }),
    ).rejects.toMatchObject(forbidden);

    // Managing project members goes through assignments.
    const viewerRole = await world.systemRoleId(org, "project_viewer");
    const assignment = await caller.permissions.assignments.assign({
      roleId: viewerRole,
      principalType: "user",
      principalId: pal.id,
      scopeType: "project",
      scopeId: projectId,
    });

    expect(assignment.scopeType).toBe("project");
    await expect(
      caller.permissions.assignments.assign({
        roleId: viewerRole,
        principalType: "user",
        principalId: pal.id,
        scopeType: "project",
        scopeId: (
          await db
            .select()
            .from(projects)
            .where(eq(projects.slug, otherProjectSlug))
        )[0]!.id,
      }),
    ).rejects.toMatchObject(forbidden);
  });
});
