import { afterAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { docs, projects, tasks, teamMembers } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("changing a project's team", () => {
  it("moves its tasks and docs to the new team", async () => {
    const org = await world.org("Team move");
    const o = await world.userIn(org, "owner", "Owner");
    const owner = await world.caller(o.user, org);
    const from = await world.team(org);
    const to = await world.team(org);
    const project = await world.project(org, {
      taskKeyPrefix: "MOV",
      teamId: from.id,
    });
    const task = await world.task(org, project, {
      taskNumber: 1,
      teamId: from.id,
    });
    const doc = await world.doc(org, {
      projectId: project.id,
      teamId: from.id,
    });

    await owner.project.updateAccess({
      slug: project.slug,
      visibility: "team",
      teamId: to.id,
    });

    const [t] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    const [d] = await db.select().from(docs).where(eq(docs.id, doc.id));

    expect(t!.teamId).toBe(to.id);
    expect(d!.teamId).toBe(to.id);
  });

  it("the general form keeps the team unless the editor may change access", async () => {
    const org = await world.org("Team gate");
    const o = await world.userIn(org, "owner", "Owner");
    const m = await world.userIn(org, "member", "Editor");
    const team = await world.team(org);
    const other = await world.team(org);
    const project = await world.project(org, {
      taskKeyPrefix: "GAT",
      teamId: team.id,
      visibility: "team",
    });

    await db.insert(teamMembers).values({
      organizationId: org.id,
      teamId: team.id,
      memberId: m.member.id,
    });
    await world.override(org, m.user, "projects.view", "allow");
    await world.override(org, m.user, "projects.update", "allow");
    await world.override(org, m.user, "projects.settings.manage", "deny");

    const editor = await world.caller(m.user, org);
    const base = {
      currentSlug: project.slug,
      name: "Renamed",
      slug: project.slug,
    };

    await expect(
      editor.project.updateProjectBySlug({ ...base, teamId: other.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await editor.project.updateProjectBySlug(base);

    const [after] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, project.id));

    expect(after!.teamId).toBe(team.id);
    expect(after!.name).toBe("Renamed");

    const owner = await world.caller(o.user, org);

    await expect(
      owner.project.updateProjectBySlug({ ...base, teamId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("an archived project", () => {
  it("refuses changes to its tasks until it is restored", async () => {
    const org = await world.org("Archived edits");
    const o = await world.userIn(org, "owner", "Owner");
    const owner = await world.caller(o.user, org);
    const project = await world.project(org, { taskKeyPrefix: "ARC" });
    const task = await world.task(org, project, { taskNumber: 1 });

    await owner.project.archiveProject({ slug: project.slug });

    await expect(
      owner.task.createTask({ projectId: project.id, name: "New" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.task.updateTaskByKey({ key: task.key, status: "done" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(owner.task.getTasksByOrgId()).resolves.toBeDefined();
    await expect(
      owner.task.createSubtask({ parentTaskKey: task.key, name: "Sub" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.sprint.create({
        projectId: project.id,
        name: "Sprint on archived",
        startsOn: "2026-12-01",
        endsOn: "2026-12-14",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await owner.project.archiveProject({ slug: project.slug });

    await expect(
      owner.task.updateTaskByKey({ key: task.key, status: "done" }),
    ).resolves.toBeDefined();
  });
});
