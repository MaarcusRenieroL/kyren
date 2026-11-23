import { db } from "@kyren/db";
import { afterAll, describe, expect, it } from "vitest";

import { getDashboardData } from "../../../apps/web/src/lib/dashboard-data";
import { loadPermissionSnapshot } from "../src/server/permissions";
import {
  forbidden,
  setMemberRole,
} from "./helpers/scoped-access-helpers";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("access that comes only from a project or team role", () => {
  async function build() {
    const org = await world.org("Project only");
    const owner = await world.userIn(org, "owner", "Pia Owner");
    const worker = await world.userIn(org, "member", "Pat Project");

    await setMemberRole(world, org, ["modules.view"]);

    const mine = await world.project(org, {
      taskKeyPrefix: "MY",
      name: "My project",
    });
    const other = await world.project(org, {
      taskKeyPrefix: "OT",
      name: "Other project",
    });

    for (const [project, label] of [
      [mine, "mine"],
      [other, "other"],
    ] as const) {
      await world.task(org, project, {
        taskNumber: 1,
        name: `${label} task`,
        createdByMemberId: owner.member.id,
        assignedToMemberId: label === "mine" ? worker.member.id : null,
      });
      await world.doc(org, {
        projectId: project.id,
        slug: `${label}-doc`,
        title: `${label} doc`,
        createdByMemberId: owner.member.id,
      });
    }

    await world.doc(org, {
      slug: "org-wide-doc",
      title: "Org wide doc",
      createdByMemberId: owner.member.id,
    });
    await world.assign(
      org,
      await world.systemRoleId(org, "project_member"),
      { type: "user", id: worker.user.id },
      { type: "project", id: mine.id },
    );

    return { org, owner, worker, mine, other };
  }

  it("reports the modules as reachable although nothing is granted organization-wide", async () => {
    const { org, worker } = await build();
    const as = await world.caller(worker.user, org);
    const me = await as.permissions.me();

    expect(me.permissions["projects.view"]).toBe(false);
    expect(me.permissions["tasks.view"]).toBe(false);
    expect(me.permissions["docs.view"]).toBe(false);
    expect(me.reachable["projects.view"]).toBe(true);
    expect(me.reachable["tasks.view"]).toBe(true);
    expect(me.reachable["docs.view"]).toBe(true);
    expect(me.reachable["tasks.create"]).toBe(true);
    expect(me.reachable["projects.update"]).toBe(false);
    expect(me.reachable["members.view"]).toBe(false);
    expect(me.reachable["roles.view"]).toBe(false);
  });

  it("someone with no role anywhere reaches nothing", async () => {
    const { org } = await build();
    const nobody = await world.userIn(org, "member", "Nina Nobody");
    const me = await (await world.caller(nobody.user, org)).permissions.me();

    expect(me.reachable["projects.view"]).toBe(false);
    expect(me.reachable["tasks.view"]).toBe(false);
    expect(me.reachable["docs.view"]).toBe(false);
  });

  it("shows only the projects they have a role in, with their tasks and docs", async () => {
    const { org, worker, mine } = await build();
    const as = await world.caller(worker.user, org);

    expect((await as.project.getProjectsByOrgId()).map((p) => p.id)).toEqual([
      mine.id,
    ]);
    expect((await as.task.getTasksByOrgId({})).map((t) => t.key)).toEqual([
      "MY-1",
    ]);
    expect((await as.docs.getAll({})).map((d) => d.slug)).toEqual(["mine-doc"]);
    expect((await as.docs.search({ query: "doc" })).map((d) => d.slug)).toEqual(
      ["mine-doc"],
    );

    const overview = await as.task.getOverview();

    expect(overview.recentlyUpdated.map((t) => t.key)).toEqual(["MY-1"]);
    expect(overview.assignedToMe.map((t) => t.key)).toEqual(["MY-1"]);
  });

  it("can open their project and its task and doc, and nothing else", async () => {
    const { org, worker, mine, other } = await build();
    const as = await world.caller(worker.user, org);

    await expect(
      as.project.getProjectBySlug({ slug: mine.slug }),
    ).resolves.toMatchObject({ slug: mine.slug, totalTasks: 1, totalDocs: 1 });
    await expect(as.task.getTaskByKey({ key: "MY-1" })).resolves.toMatchObject({
      key: "MY-1",
    });
    await expect(
      as.docs.getBySlug({ slug: "mine-doc" }),
    ).resolves.toMatchObject({ slug: "mine-doc" });
    await expect(
      as.project.getProjectBySlug({ slug: other.slug }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      as.project.getProjectBySlug({ slug: "no-such-project" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      as.docs.getBySlug({ slug: "other-doc" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      as.docs.getBySlug({ slug: "org-wide-doc" }),
    ).rejects.toMatchObject(forbidden);
  });

  it("the dashboard counts and links follow the same reach", async () => {
    const { org, worker } = await build();
    const snapshot = await loadPermissionSnapshot(db, org.id, worker.user.id);
    const dashboard = await getDashboardData({
      organizationId: org.id,
      userId: worker.user.id,
      enabledModules: new Set(["projects", "tasks", "docs"]),
      snapshot,
      timeZone: "UTC",
    });
    const stat = (label: string) =>
      dashboard.workspaceStats.find((item) => item.label === label)?.value;

    expect(stat("Projects")).toBe(1);
    expect(stat("Open tasks")).toBe(1);
    expect(stat("Docs")).toBe(1);
    expect(stat("Members")).toBeUndefined();
    expect(stat("Teams")).toBeUndefined();
    expect(dashboard.tasks.map((task) => task.title)).toEqual(["mine task"]);
    expect(dashboard.links).toMatchObject({
      projects: "/projects",
      tasks: "/tasks",
      docs: "/docs",
      newTask: "/tasks",
      newDoc: "/docs",
    });
  });

  it("a role given on a team reaches that team's projects and docs", async () => {
    const org = await world.org("Team scope");
    const owner = await world.userIn(org, "owner", "Tia Owner");
    const worker = await world.userIn(org, "member", "Wes Worker");
    const team = await world.team(org);
    const elsewhere = await world.team(org);

    await setMemberRole(world, org, []);

    const project = await world.project(org, {
      taskKeyPrefix: "TM",
      teamId: team.id,
    });
    const foreign = await world.project(org, {
      taskKeyPrefix: "FG",
      teamId: elsewhere.id,
    });

    await world.task(org, project, {
      taskNumber: 1,
      createdByMemberId: owner.member.id,
    });
    await world.task(org, foreign, {
      taskNumber: 1,
      createdByMemberId: owner.member.id,
    });
    await world.doc(org, {
      teamId: team.id,
      slug: "team-doc",
      createdByMemberId: owner.member.id,
    });
    await world.doc(org, {
      teamId: elsewhere.id,
      slug: "foreign-team-doc",
      createdByMemberId: owner.member.id,
    });

    const viewer = await world.role(org, {
      name: "Team reader",
      scope: "team",
      permissions: ["teams.view", "projects.view", "tasks.view", "docs.view"],
    });

    await world.assign(
      org,
      viewer.id,
      { type: "user", id: worker.user.id },
      { type: "team", id: team.id },
    );

    const as = await world.caller(worker.user, org);
    const me = await as.permissions.me();

    expect(me.reachable["projects.view"]).toBe(true);
    expect(me.reachable["tasks.view"]).toBe(true);
    expect(me.reachable["docs.view"]).toBe(true);
    expect(me.reachable["teams.view"]).toBe(true);
    expect((await as.task.getTasksByOrgId({})).map((t) => t.key)).toEqual([
      "TM-1",
    ]);
    expect((await as.docs.getAll({})).map((d) => d.slug)).toEqual(["team-doc"]);
    await expect(
      as.docs.getBySlug({ slug: "foreign-team-doc" }),
    ).rejects.toMatchObject(forbidden);
    expect((await as.team.getAll()).map((t) => t.id)).toEqual([team.id]);
  });
});
