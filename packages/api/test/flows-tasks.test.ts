import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { activityEvents, taskComments, tasks } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg } from "./helpers";

const world = new World();

type Caller = Awaited<ReturnType<World["caller"]>>;

let org: TestOrg;
let ownerMemberId: string;
let as: Caller;
let projectId: string;

beforeAll(async () => {
  org = await world.org("Flows-Tasks");
  const created = await world.userIn(org, "owner", "Flow Task Owner");

  ownerMemberId = created.member.id;
  as = await world.caller(created.user, org);

  const project = await as.project.createProject({
    name: "Planning Area",
    slug: "planning-area",
    description: "",
  });

  projectId = project.id;
});

afterAll(() => world.cleanup());

describe("tasks", () => {
  it("generates sequential keys per project (PA-1, PA-2)", async () => {
    const first = await as.task.createTask({ projectId, name: "First" });
    const second = await as.task.createTask({ projectId, name: "Second" });

    expect([first.key, second.key]).toEqual(["PA-1", "PA-2"]);
    expect([first.taskNumber, second.taskNumber]).toEqual([1, 2]);
    expect(first).toMatchObject({
      status: "todo",
      priority: "medium",
      organizationId: org.id,
      createdByMemberId: ownerMemberId,
    });
  });

  it("does not reuse the number of a deleted task", async () => {
    const created = await as.task.createTask({ projectId, name: "Gone" });

    await as.task.deleteTaskByKey({ key: created.key });

    const next = await as.task.createTask({ projectId, name: "After gone" });

    expect(next.taskNumber).toBe(created.taskNumber + 1);
  });

  it("restarts numbering for another project", async () => {
    const other = await as.project.createProject({
      name: "Other Area",
      slug: "other-area",
      description: "",
    });
    const task = await as.task.createTask({ projectId: other.id, name: "One" });

    expect(task.key).toBe("OA-1");
  });

  it("records a task.created activity event", async () => {
    const task = await as.task.createTask({ projectId, name: "Tracked" });
    const events = await as.activity.getTaskActivityEvents({
      taskKey: task.key,
    });

    expect(events.map((event) => event.type)).toContain("task.created");
  });

  it("updates fields and records the change in the activity feed", async () => {
    const task = await as.task.createTask({ projectId, name: "To update" });

    await as.task.updateTaskByKey({
      key: task.key,
      name: "Updated",
      status: "in-progress",
      priority: "high",
      assignedToMemberId: ownerMemberId,
    });

    const updated = await as.task.getTaskByKey({ key: task.key });

    expect(updated).toMatchObject({
      name: "Updated",
      status: "in-progress",
      priority: "high",
      assignedToMemberId: ownerMemberId,
    });

    const events = await as.activity.getTaskActivityEvents({
      taskKey: task.key,
    });

    expect(events.length).toBeGreaterThan(1);
  });

  it("lists tasks for the organization", async () => {
    const list = await as.task.getTasksByOrgId({});

    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(list.every((task) => typeof task.key === "string")).toBe(true);
  });

  it("deletes a task softly and hides it", async () => {
    const task = await as.task.createTask({ projectId, name: "Delete me" });

    await as.task.deleteTaskByKey({ key: task.key });

    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));

    expect(row!.deletedAt).not.toBeNull();
    await expect(
      as.task.getTaskByKey({ key: task.key }),
    ).resolves.toBeUndefined();
  });

  it("adds and lists task comments", async () => {
    const task = await as.task.createTask({ projectId, name: "Discuss" });

    await as.comment.createTaskComment({
      taskKey: task.key,
      body: "Looks good",
    });

    const comments = await as.comment.getTaskComments({ taskKey: task.key });

    expect(comments.map((comment) => comment.body)).toEqual(["Looks good"]);

    const rows = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, task.id));

    expect(rows[0]!.authorMemberId).toBe(ownerMemberId);

    const events = await db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.targetId, task.id));

    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it("creates distinct sequential keys under concurrent requests", async () => {
    const before = await as.task.getTasksByOrgId({});
    const highest = Math.max(
      ...before
        .filter((task) => task.key.startsWith("PA-"))
        .map((task) => Number(task.key.slice(3))),
    );

    const created = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        as.task.createTask({ projectId, name: `Race ${index}` }),
      ),
    );

    const numbers = created
      .map((task) => task.taskNumber)
      .sort((a, b) => a - b);

    expect(new Set(created.map((task) => task.key)).size).toBe(12);
    expect(numbers).toEqual(
      Array.from({ length: 12 }, (_, index) => highest + 1 + index),
    );
    expect(created.every((task) => task.key === `PA-${task.taskNumber}`)).toBe(
      true,
    );
  });
});
