import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("createSubtask checks who it assigns", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let parentKey: string;
  let colleagueId: string;
  let strangerId: string;

  beforeAll(async () => {
    const org = await world.org("Subtask assignee");
    const other = await world.org("Subtask assignee other");
    const o = await world.userIn(org, "owner", "Priya");
    const c = await world.userIn(org, "member", "Colleague");
    const s = await world.userIn(other, "member", "Stranger");

    owner = await world.caller(o.user, org);
    colleagueId = c.member.id;
    strangerId = s.member.id;

    const project = await world.project(org, { taskKeyPrefix: "ST" });

    parentKey = (await world.task(org, project, { taskNumber: 1 })).key;
  });

  it("refuses a member of another organization", async () => {
    await expect(
      owner.task.createSubtask({
        parentTaskKey: parentKey,
        name: "Sneaky",
        assignedToMemberId: strangerId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("assigns a colleague", async () => {
    const subtask = await owner.task.createSubtask({
      parentTaskKey: parentKey,
      name: "Fine",
      assignedToMemberId: colleagueId,
    });

    expect(subtask).toMatchObject({ assignedToMemberId: colleagueId });
  });
});
