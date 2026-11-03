import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("a person can export their own data and nothing else", () => {
  let max: Caller;
  let owner: Caller;
  let maxEmail: string;

  beforeAll(async () => {
    const org = await world.org("Export");
    const o = await world.userIn(org, "owner", "Olive Owner");
    const m = await world.userIn(org, "member", "Max Member");

    maxEmail = m.user.email;
    owner = await world.caller(o.user, org);
    max = await world.caller(m.user, org);

    const project = await owner.project.createProject({
      name: "Export project",
      slug: "export-project",
      description: "",
    });
    const mine = await max.task.createTask({
      projectId: project.id,
      name: "Max's own task",
    });
    const theirs = await owner.task.createTask({
      projectId: project.id,
      name: "Olive's task",
    });

    await max.comment.createTaskComment({
      taskKey: mine.key,
      body: "Max says hi",
    });
    await owner.comment.createTaskComment({
      taskKey: theirs.key,
      body: "Olive's private thought",
    });

    const open = await owner.chat.create({
      name: "open",
      memberIds: [m.member.id],
    });
    const secret = await owner.chat.create({
      name: "secret",
      visibility: "private",
      memberIds: [],
    });

    await max.chat.send({ channelId: open.id, body: "hello channel" });
    await owner.chat.send({ channelId: secret.id, body: "olive secret" });
    await owner.chat.send({ channelId: open.id, body: "olive public" });
  });

  it("includes their profile and own work", async () => {
    const data = await max.user.exportMyData();

    expect(data.profile.email).toBe(maxEmail);
    expect(data.tasksCreated.map((t) => t.name)).toEqual(["Max's own task"]);
    expect(data.taskComments.map((c) => c.body)).toEqual(["Max says hi"]);
    expect(data.chatMessages.map((c) => c.body)).toEqual(["hello channel"]);
  });

  it("leaves out everyone else's words and places they cannot read", async () => {
    const text = JSON.stringify(await max.user.exportMyData());

    expect(text).not.toContain("Olive's private thought");
    expect(text).not.toContain("olive secret");
    expect(text).not.toContain("olive public");
    expect(text).not.toContain("Olive's task");
  });

  it("gives each person only their own", async () => {
    const data = await owner.user.exportMyData();

    expect(JSON.stringify(data)).not.toContain("Max says hi");
    expect(JSON.stringify(data)).not.toContain(maxEmail);
  });
});
