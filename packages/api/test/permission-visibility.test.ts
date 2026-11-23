import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { projects, teamMembers } from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg } from "./helpers";
import {
  type Caller,
  forbidden,
  notFound,
} from "./helpers/permission-helpers";

const world = new World();
afterAll(() => world.cleanup());

describe("project visibility", () => {
  let org: TestOrg;
  let outsider: Caller;
  let teamMember: Caller;
  let assigned: Caller;
  let admin: Caller;
  let ids: { orgProject: string; teamProject: string; privateProject: string };

  beforeAll(async () => {
    org = await world.org("Visibility");
    const owner = await world.userIn(org, "owner");
    const adminU = await world.userIn(org, "admin");
    const out = await world.userIn(org, "member", "Olly Outsider");
    const tm = await world.userIn(org, "member", "Tina Team");
    const as = await world.userIn(org, "member", "Andy Assigned");
    const team = await world.team(org, { name: "Visible team" });

    await db.insert(teamMembers).values({
      organizationId: org.id,
      teamId: team.id,
      memberId: tm.member.id,
    });

    const orgProject = await world.project(org, {
      taskKeyPrefix: "VO",
      visibility: "organization",
    });
    const teamProject = await world.project(org, {
      taskKeyPrefix: "VT",
      visibility: "team",
      teamId: team.id,
    });
    const privateProject = await world.project(org, {
      taskKeyPrefix: "VP",
      visibility: "private",
    });

    ids = {
      orgProject: orgProject.id,
      teamProject: teamProject.id,
      privateProject: privateProject.id,
    };

    for (const [project, label] of [
      [orgProject, "O"],
      [teamProject, "T"],
      [privateProject, "P"],
    ] as const) {
      await world.task(org, project, {
        taskNumber: 1,
        name: `${label} task`,
        createdByMemberId: owner.member.id,
      });
      await world.doc(org, {
        projectId: project.id,
        title: `${label} doc`,
        slug: `${label.toLowerCase()}-doc`,
      });
    }

    await world.assign(
      org,
      await world.systemRoleId(org, "project_viewer"),
      { type: "user", id: as.user.id },
      { type: "project", id: privateProject.id },
    );

    outsider = await world.caller(out.user, org);
    teamMember = await world.caller(tm.user, org);
    assigned = await world.caller(as.user, org);
    admin = await world.caller(adminU.user, org);
  });

  it("an outsider sees only organization-visible projects, in every list", async () => {
    expect(
      (await outsider.project.getProjectsByOrgId()).map((p) => p.id),
    ).toEqual([ids.orgProject]);
    expect((await outsider.task.getTasksByOrgId({})).map((t) => t.key)).toEqual(
      ["VO-1"],
    );
    expect((await outsider.docs.getAll({})).map((d) => d.slug)).toEqual([
      "o-doc",
    ]);
    expect(
      (await outsider.docs.search({ query: "doc" })).map((d) => d.slug),
    ).toEqual(["o-doc"]);

    const overview = await outsider.task.getOverview();

    expect(overview.recentlyUpdated.map((t) => t.key)).toEqual(["VO-1"]);
    expect(overview.byStatus.reduce((sum, row) => sum + row.count, 0)).toBe(1);
  });

  it("hidden projects and their contents look like they do not exist", async () => {
    // Same answer as an unknown key, so keys cannot be probed.
    await expect(
      outsider.task.getTaskByKey({ key: "VP-1" }),
    ).resolves.toBeUndefined();
    await expect(
      outsider.docs.getBySlug({ slug: "p-doc" }),
    ).rejects.toMatchObject(notFound);
    await expect(
      outsider.project.getProjectBySlug({
        slug: (
          await db
            .select()
            .from(projects)
            .where(eq(projects.id, ids.privateProject))
        )[0]!.slug,
      }),
    ).rejects.toMatchObject(notFound);
    await expect(
      outsider.task.updateTaskByKey({ key: "VP-1", name: "x" }),
    ).rejects.toMatchObject(notFound);
    await expect(
      outsider.task.createTask({ projectId: ids.privateProject, name: "x" }),
    ).rejects.toMatchObject(notFound);
  });

  it("team members also see the team project", async () => {
    expect(
      (await teamMember.project.getProjectsByOrgId()).map((p) => p.id).sort(),
    ).toEqual([ids.orgProject, ids.teamProject].sort());
    expect(
      (await teamMember.task.getTasksByOrgId({})).map((t) => t.key).sort(),
    ).toEqual(["VO-1", "VT-1"]);
  });

  it("a project assignment reveals a private project", async () => {
    expect(
      (await assigned.project.getProjectsByOrgId()).map((p) => p.id).sort(),
    ).toEqual([ids.orgProject, ids.privateProject].sort());
    expect((await assigned.docs.getAll({})).map((d) => d.slug).sort()).toEqual([
      "o-doc",
      "p-doc",
    ]);
  });

  it("admins can see every project", async () => {
    expect((await admin.project.getProjectsByOrgId()).length).toBe(3);
    expect((await admin.docs.getAll({})).length).toBe(3);
  });

  it("changing visibility needs projects.settings.manage and takes effect", async () => {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, ids.orgProject));

    await expect(
      outsider.project.updateAccess({
        slug: project!.slug,
        visibility: "private",
        teamId: null,
      }),
    ).rejects.toMatchObject(forbidden);

    await admin.project.updateAccess({
      slug: project!.slug,
      visibility: "private",
      teamId: null,
    });

    expect((await outsider.project.getProjectsByOrgId()).length).toBe(0);

    await admin.project.updateAccess({
      slug: project!.slug,
      visibility: "organization",
      teamId: null,
    });
  });

  it("a team-visible project needs a team", async () => {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, ids.orgProject));

    await expect(
      admin.project.updateAccess({
        slug: project!.slug,
        visibility: "team",
        teamId: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
