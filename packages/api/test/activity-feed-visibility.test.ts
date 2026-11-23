import { db } from "@zentro/db";
import { teamMembers } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDashboardData } from "../../../apps/web/src/lib/dashboard-data";
import { loadPermissionSnapshot } from "../src/server/permissions";
import { World, type TestOrg, type TestUser } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const forbidden = { code: "FORBIDDEN" };

const scenarios = [
  { label: "private", visibility: "private" as const, teamSees: false },
  { label: "team", visibility: "team" as const, teamSees: true },
];

describe.each(scenarios)("$label project activity", (scenario) => {
  let org: TestOrg;
  let owner: Caller;
  let admin: Caller;
  let outsider: Caller;
  let projectMember: Caller;
  let teamMember: Caller;
  let users: Record<string, TestUser>;
  let projectId: string;
  let taskId: string;
  let taskKey: string;
  let docId: string;

  beforeAll(async () => {
    org = await world.org(`Activity ${scenario.label}`);
    const o = await world.userIn(org, "owner", "Olive Owner");
    const a = await world.userIn(org, "admin", "Ada Admin");
    const out = await world.userIn(org, "member", "Otto Outsider");
    const pm = await world.userIn(org, "member", "Pia Project");
    const tm = await world.userIn(org, "member", "Tess Team");

    users = {
      owner: o.user,
      admin: a.user,
      out: out.user,
      pm: pm.user,
      tm: tm.user,
    };

    const team = await world.team(org);

    await db.insert(teamMembers).values({
      organizationId: org.id,
      teamId: team.id,
      memberId: tm.member.id,
    });

    owner = await world.caller(o.user, org);

    const project = await owner.project.createProject({
      name: "Secret",
      slug: `secret-${scenario.label}`,
      description: "",
    });

    projectId = project.id;
    await owner.project.updateAccess({
      slug: project.slug,
      visibility: scenario.visibility,
      teamId: scenario.visibility === "team" ? team.id : null,
    });

    // An open project, so empty results are not just empty data.
    const open = await owner.project.createProject({
      name: "Open",
      slug: `open-${scenario.label}`,
      description: "",
    });
    const task = await owner.task.createTask({
      projectId,
      name: "Hidden work",
    });

    taskId = task.id;
    taskKey = task.key;
    await owner.task.updateTaskByKey({ key: task.key, status: "done" });
    await owner.comment.createTaskComment({ taskKey: task.key, body: "note" });
    await owner.task.createTask({ projectId: open.id, name: "Open work" });

    const doc = await owner.docs.create({
      projectId,
      title: "Secret doc",
      slug: `sd-${scenario.label}`,
    });

    docId = doc.id;

    await world.assign(
      org,
      await world.systemRoleId(org, "project_viewer"),
      { type: "user", id: pm.user.id },
      { type: "project", id: projectId },
    );

    admin = await world.caller(a.user, org);
    outsider = await world.caller(out.user, org);
    projectMember = await world.caller(pm.user, org);
    teamMember = await world.caller(tm.user, org);
  });

  const mentions = (items: Array<{ projectId: string | null }>) =>
    items.some((item) => item.projectId === projectId);

  it("the project, task and doc feeds show a project member everything", async () => {
    const project = await projectMember.activity.list({ projectId });
    const task = await projectMember.activity.list({
      targetType: "task",
      targetId: taskId,
    });
    const doc = await projectMember.activity.list({
      targetType: "doc",
      targetId: docId,
    });

    expect(project.items.length).toBeGreaterThanOrEqual(4);
    expect(task.items.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "task.created",
        "task.status_changed",
        "task.comment_added",
      ]),
    );
    expect(doc.items.map((event) => event.action)).toContain("doc.created");
  });

  it("hides all of it from an outsider", async () => {
    expect((await outsider.activity.list({ projectId })).items).toEqual([]);
    expect(
      (await outsider.activity.list({ targetType: "task", targetId: taskId }))
        .items,
    ).toEqual([]);
    expect(
      (await outsider.activity.list({ targetType: "doc", targetId: docId }))
        .items,
    ).toEqual([]);
    await expect(
      outsider.activity.getTaskActivityEvents({ taskKey }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("shows team members what their team's project allows", async () => {
    const items = (await teamMember.activity.list({ projectId })).items;

    expect(items.length > 0).toBe(scenario.teamSees);
  });

  it("keeps hidden projects out of the organization feed, and needs activity.view_org", async () => {
    await expect(
      outsider.activity.list({ scope: "organization" }),
    ).rejects.toMatchObject(forbidden);

    const adminFeed = await admin.activity.list({ scope: "organization" });

    expect(mentions(adminFeed.items)).toBe(true);

    const role = await world.role(org, {
      name: "Feed reader",
      permissions: [
        "activity.view_org",
        "tasks.view",
        "docs.view",
        "projects.view",
      ],
    });

    await world.assign(
      org,
      role.id,
      { type: "user", id: users.out!.id },
      { type: "organization", id: org.id },
    );

    const feed = await (
      await world.caller(users.out!, org)
    ).activity.list({
      scope: "organization",
    });

    expect(mentions(feed.items)).toBe(false);
    expect(
      feed.items.some(
        (event) =>
          event.targetLabel === "Open work" ||
          event.targetLabel?.endsWith("-1"),
      ),
    ).toBe(true);
  });

  it("keeps the dashboard feed in line", async () => {
    const feed = async (user: TestUser) =>
      (
        await getDashboardData({
          organizationId: org.id,
          userId: user.id,
          enabledModules: new Set(["projects", "tasks", "docs"]),
          snapshot: await loadPermissionSnapshot(db, org.id, user.id),
          timeZone: "UTC",
        })
      ).recentActivity.map((item) => item.action);

    expect((await feed(users.pm!)).some((text) => text.includes(taskKey))).toBe(
      true,
    );
    expect(
      (await feed(users.out!)).some((text) => text.includes(taskKey)),
    ).toBe(false);
  });

  it("hides audit-only events from every feed", async () => {
    const all = [
      ...(await owner.activity.list({ projectId })).items,
      ...(await admin.activity.list({ scope: "organization" })).items,
    ];

    expect(
      all.some((event) => event.action === "project.visibility_changed"),
    ).toBe(false);
    expect(all.some((event) => event.action.startsWith("assignment."))).toBe(
      false,
    );
  });

  it("shows a deleted project's events only to people who can see every private project", async () => {
    const doomed = await owner.project.createProject({
      name: "Doomed",
      slug: `doomed-${scenario.label}`,
      description: "",
    });

    await owner.permissions.assignments.assign({
      roleId: await world.systemRoleId(org, "project_member"),
      principalType: "user",
      principalId: users.pm!.id,
      scopeType: "project",
      scopeId: doomed.id,
    });
    await owner.task.createTask({ projectId: doomed.id, name: "Gone soon" });
    await owner.project.deleteProject({ slug: doomed.slug });

    expect(
      (await admin.activity.list({ projectId: doomed.id })).items.length,
    ).toBeGreaterThan(0);
    expect(
      (await projectMember.activity.list({ projectId: doomed.id })).items,
    ).toEqual([]);
    expect(
      (await outsider.activity.list({ projectId: doomed.id })).items,
    ).toEqual([]);
  });

  it("validates what a feed is asked for", async () => {
    await expect(owner.activity.list({} as never)).rejects.toThrow();
    await expect(
      owner.activity.list({ projectId, scope: "organization" }),
    ).rejects.toThrow();
  });
});
