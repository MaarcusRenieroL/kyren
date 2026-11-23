import { db } from "@kyren/db";
import { and, eq } from "@kyren/db/drizzle";
import { activityEvents } from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fetchEvents as events } from "./helpers/activity-recording-helpers";
import { World, type TestOrg, type TestUser } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("events are recorded for entity mutations", () => {
  let org: TestOrg;
  let owner: Caller;
  let ownerUser: TestUser;
  let memberUser: TestUser;
  let memberId: string;
  let projectId: string;
  let projectSlug: string;
  let teamId: string;

  beforeAll(async () => {
    org = await world.org("Rec-Entities");
    const o = await world.userIn(org, "owner", "Olive Owner");
    const m = await world.userIn(org, "member", "Max Member");

    ownerUser = o.user;
    memberUser = m.user;
    memberId = m.member.id;
    owner = await world.caller(o.user, org, {
      headers: {
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        "user-agent": "Vitest/1.0",
      },
    });

    const project = await owner.project.createProject({
      name: "Atlas",
      slug: "atlas",
      description: "",
    });

    projectId = project.id;
    projectSlug = project.slug;
    teamId = (
      await owner.team.create({
        name: "Platform",
        color: "blue",
        memberIds: [],
      })
    ).id;
  });

  it("records the project with its lead assignment, actor and request context", async () => {
    const [created] = await events(org, "project.created");

    expect(created).toMatchObject({
      actorUserId: ownerUser.id,
      targetType: "project",
      targetId: projectId,
      targetLabel: "Atlas",
      projectId,
      auditOnly: false,
      ip: "203.0.113.7",
      userAgent: "Vitest/1.0",
    });
    expect(created!.requestId).toMatch(/^[0-9a-f-]{36}$/);

    const [lead] = await events(org, "assignment.created");

    expect(lead).toMatchObject({
      auditOnly: true,
      projectId,
      requestId: created!.requestId,
    });
    expect(lead!.metadata).toMatchObject({
      roleName: "Project lead",
      creator: true,
    });
  });

  it("records team events", async () => {
    expect((await events(org, "team.created"))[0]).toMatchObject({
      targetType: "team",
      targetLabel: "Platform",
      teamId,
      auditOnly: false,
    });

    await owner.team.update({
      id: teamId,
      name: "Platform eng",
      color: "green",
    });

    const [updated] = await events(org, "team.updated");

    expect(updated!.metadata.changes).toEqual([
      { field: "name", from: "Platform", to: "Platform eng" },
      { field: "color", from: "blue", to: "green" },
    ]);

    await owner.team.updateMembers({ teamId, memberIds: [memberId] });
    await owner.team.updateMembers({ teamId, memberIds: [] });

    expect((await events(org, "team.member_added"))[0]!.metadata).toMatchObject(
      {
        memberId,
        userId: memberUser.id,
        name: "Max Member",
      },
    );
    expect(await events(org, "team.member_removed")).toHaveLength(1);

    await owner.team.updateMembers({ teamId, memberIds: [] });
    expect(await events(org, "team.member_added")).toHaveLength(1);

    const second = await owner.team.create({
      name: "Doomed",
      color: "red",
      memberIds: [],
    });

    await owner.team.delete({ id: second.id });
    expect((await events(org, "team.deleted"))[0]).toMatchObject({
      targetId: second.id,
      targetLabel: "Doomed",
    });
  });

  it("records task events with field changes", async () => {
    const task = await owner.task.createTask({ projectId, name: "Write plan" });

    expect((await events(org, "task.created"))[0]).toMatchObject({
      actorUserId: ownerUser.id,
      targetType: "task",
      targetId: task.id,
      targetLabel: task.key,
      projectId,
    });

    await owner.task.updateTaskByKey({
      key: task.key,
      status: "in-progress",
      priority: "high",
      assignedToMemberId: memberId,
    });

    const [status] = await events(org, "task.status_changed");
    const [assigned] = await events(org, "task.assigned");
    const [updated] = await events(org, "task.updated");

    expect(status!.metadata.changes).toEqual([
      { field: "status", from: "todo", to: "in-progress" },
    ]);
    expect(assigned!.metadata.changes).toEqual([
      { field: "assignee", from: null, to: "Max Member" },
    ]);
    expect(updated!.metadata.changes).toEqual([
      { field: "priority", from: "medium", to: "high" },
    ]);

    const before = (await events(org)).length;

    await owner.task.updateTaskByKey({ key: task.key, status: "in-progress" });
    expect((await events(org)).length).toBe(before);

    await owner.comment.createTaskComment({
      taskKey: task.key,
      body: "Looks ok",
    });

    const [comment] = await events(org, "task.comment_added");

    expect(comment).toMatchObject({ targetId: task.id, targetLabel: task.key });
    expect(comment!.metadata.commentId).toBeTruthy();

    await owner.task.deleteTaskByKey({ key: task.key });
    expect((await events(org, "task.deleted"))[0]).toMatchObject({
      targetId: task.id,
      targetLabel: task.key,
      projectId,
    });
  });

  it("truncates long values in changes", async () => {
    const task = await owner.task.createTask({ projectId, name: "Long text" });

    await owner.task.updateTaskByKey({
      key: task.key,
      description: "x".repeat(1000),
    });

    const updated = (await events(org, "task.updated")).at(-1)!;
    const change = (updated.metadata.changes as Array<{ to: string }>)[0]!;

    expect(change.to.length).toBeLessThanOrEqual(201);
  });

  it("records project changes", async () => {
    await owner.project.updateProjectBySlug({
      currentSlug: projectSlug,
      name: "Atlas 2",
      slug: projectSlug,
      description: "New",
    });

    const [updated] = await events(org, "project.updated");

    expect(updated!.metadata.changes).toEqual([
      { field: "name", from: "Atlas", to: "Atlas 2" },
      { field: "description", from: null, to: "New" },
    ]);

    await owner.project.updateAccess({
      slug: projectSlug,
      visibility: "private",
      teamId: null,
    });

    const [visibility] = await events(org, "project.visibility_changed");

    expect(visibility).toMatchObject({ auditOnly: true, projectId });
    expect(visibility!.metadata.changes).toEqual([
      { field: "visibility", from: "organization", to: "private" },
    ]);

    await owner.project.archiveProject({ slug: projectSlug });
    await owner.project.archiveProject({ slug: projectSlug });
    expect(await events(org, "project.archived")).toHaveLength(1);
    expect(await events(org, "project.restored")).toHaveLength(1);

    const doomed = await owner.project.createProject({
      name: "Doomed",
      slug: "doomed",
      description: "",
    });

    await owner.project.deleteProject({ slug: "doomed" });

    expect((await events(org, "project.deleted"))[0]).toMatchObject({
      targetId: doomed.id,
      targetLabel: "Doomed",
      projectId: doomed.id,
    });
  });
});
