import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("notification preferences filter the inbox", () => {
  let owner: Caller;
  let max: Caller;
  let maxId: string;
  let projectId: string;

  beforeAll(async () => {
    const org = await world.org("Notification prefs");
    const o = await world.userIn(org, "owner", "Olive Owner");
    const m = await world.userIn(org, "member", "Max Member");

    maxId = m.member.id;
    owner = await world.caller(o.user, org);
    max = await world.caller(m.user, org);
    projectId = (
      await owner.project.createProject({
        name: "Prefs project",
        slug: "prefs-project",
        description: "",
      })
    ).id;

    const task = await owner.task.createTask({ projectId, name: "Mine" });

    await owner.task.updateTaskByKey({
      key: task.key,
      assignedToMemberId: maxId,
    });
    await owner.comment.createTaskComment({ taskKey: task.key, body: "Hi" });
  });

  const kinds = async () =>
    (await max.notification.list()).map((item) => item.kind).sort();

  it("has everything on by default", async () => {
    expect(await max.notification.getPreferences()).toEqual({ mutedKinds: [] });
    expect(await kinds()).toEqual(["assignment", "comment"]);
  });

  it("hides a muted kind and keeps the rest", async () => {
    await max.notification.setPreferences({ mutedKinds: ["comment"] });

    expect(await max.notification.getPreferences()).toEqual({
      mutedKinds: ["comment"],
    });
    expect(await kinds()).toEqual(["assignment"]);
  });

  it("belongs to the person who set it", async () => {
    expect(await owner.notification.getPreferences()).toEqual({
      mutedKinds: [],
    });
  });

  it("deduplicates and refuses unknown kinds", async () => {
    await max.notification.setPreferences({
      mutedKinds: ["comment", "comment", "mention"],
    });
    expect((await max.notification.getPreferences()).mutedKinds.sort()).toEqual(
      ["comment", "mention"],
    );

    await expect(
      max.notification.setPreferences({ mutedKinds: ["bogus" as never] }),
    ).rejects.toThrow();
  });

  it("turns everything back on", async () => {
    await max.notification.setPreferences({ mutedKinds: [] });

    expect(await kinds()).toEqual(["assignment", "comment"]);
  });
});
