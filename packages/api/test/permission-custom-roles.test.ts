import { ensureSystemRoles } from "@zentro/auth";
import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { members, roles, teamMembers } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg } from "./helpers";
import {
  type Caller,
  expectAllowed,
  forbidden,
} from "./helpers/permission-helpers";

const world = new World();
afterAll(() => world.cleanup());

describe("custom roles, project roles and overrides: custom roles & overrides", () => {
  let org: TestOrg;
  let owner: Caller;
  let projectId: string;

  beforeAll(async () => {
    org = await world.org("RestrictedCustom");
    owner = await world.caller((await world.userIn(org, "owner")).user, org);

    // The base Member role grants nothing but project viewing.
    await ensureSystemRoles(db, org.id);
    await db
      .update(roles)
      .set({ permissions: ["projects.view"] })
      .where(
        and(eq(roles.organizationId, org.id), eq(roles.systemKey, "member")),
      );

    const project = await world.project(org, { taskKeyPrefix: "RS" });
    projectId = project.id;
    await world.task(org, project, { taskNumber: 1, name: "Scoped task" });
  });

  it("a custom organization role grants exactly what it lists", async () => {
    const role = await world.role(org, {
      name: "Viewer plus comment",
      permissions: ["tasks.view", "tasks.comment", "projects.view"],
    });
    const user = (await world.userIn(org, "member", "Cleo Custom")).user;

    await world.assign(
      org,
      role.id,
      { type: "user", id: user.id },
      { type: "organization", id: org.id },
    );

    const caller = await world.caller(user, org);

    await expectAllowed(
      caller.comment.createTaskComment({ taskKey: "RS-1", body: "ok" }),
    );
    await expect(
      caller.task.updateTaskByKey({ key: "RS-1", name: "x" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      caller.task.createTask({ projectId, name: "x" }),
    ).rejects.toMatchObject(forbidden);
  });

  it("a deny override beats a role grant", async () => {
    const role = await world.role(org, {
      name: "Doc worker",
      permissions: ["docs.view", "docs.create"],
    });
    const user = (await world.userIn(org, "member", "Dan Denied")).user;

    await world.assign(
      org,
      role.id,
      { type: "user", id: user.id },
      { type: "organization", id: org.id },
    );
    await expectAllowed(
      (await world.caller(user, org)).docs.create({
        title: "Before",
        slug: "before-deny",
      }),
    );

    await world.override(org, user, "docs.create", "deny");

    await expect(
      (await world.caller(user, org)).docs.create({
        title: "After",
        slug: "after-deny",
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("an allow override adds a single permission", async () => {
    const user = (await world.userIn(org, "member", "Alex Allowed")).user;

    await expect(
      (await world.caller(user, org)).team.create({
        name: "Allow team",
        color: "slate",
      }),
    ).rejects.toMatchObject(forbidden);

    await world.override(org, user, "teams.create", "allow");

    await expectAllowed(
      (await world.caller(user, org)).team.create({
        name: "Allow team",
        color: "slate",
      }),
    );
  });

  it("a user who is not a member has no access at all", async () => {
    const stranger = await world.user("Stranger");
    const caller = await world.caller(stranger, org);

    await expect(caller.project.getProjectsByOrgId()).rejects.toMatchObject(
      forbidden,
    );
    await expect(caller.task.getTasksByOrgId({})).rejects.toMatchObject(
      forbidden,
    );
    await expect(caller.member.getMembers()).rejects.toMatchObject(forbidden);
    await expect(caller.modules.list()).rejects.toMatchObject(forbidden);
  });

  it("team role assignments apply to every member of the team", async () => {
    const team = await world.team(org, { name: "Docs squad" });
    const user = (await world.userIn(org, "member", "Tess Teammate")).user;
    const [member] = await db
      .select()
      .from(members)
      .where(
        and(eq(members.userId, user.id), eq(members.organizationId, org.id)),
      );
    const role = await world.role(org, {
      name: "Docs writers",
      permissions: ["docs.view", "docs.create"],
    });

    await expect(
      (await world.caller(user, org)).docs.create({
        title: "T1",
        slug: "team-doc-1",
      }),
    ).rejects.toMatchObject(forbidden);

    await db.insert(teamMembers).values({
      organizationId: org.id,
      teamId: team.id,
      memberId: member!.id,
    });
    await world.assign(
      org,
      role.id,
      { type: "team", id: team.id },
      { type: "organization", id: org.id },
    );

    await expectAllowed(
      (await world.caller(user, org)).docs.create({
        title: "T2",
        slug: "team-doc-2",
      }),
    );
  });

  it("owners keep working whatever the roles say", async () => {
    await expectAllowed(
      owner.project.createProject({
        name: "Owner project",
        slug: "owner-project",
        description: "",
      }),
    );
  });
});
