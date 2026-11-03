import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const config = {
  search: "launch",
  status: "in-progress",
  priority: "high",
  assignee: "all",
  team: "all",
  group: "priority",
  sort: "due",
  view: "board",
} as const;

describe("saved task views", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let member: Awaited<ReturnType<World["caller"]>>;
  let outsider: Awaited<ReturnType<World["caller"]>>;

  beforeAll(async () => {
    const org = await world.org("Views");
    const o = await world.userIn(org, "owner", "View Owner");
    const m = await world.userIn(org, "member", "View Member");
    const other = await world.org("Views elsewhere");
    const x = await world.userIn(other, "owner", "View Outsider");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
  });

  it("keeps a private view to its owner and a shared one visible to the team", async () => {
    await owner.taskView.create({ name: "My focus", config });
    await owner.taskView.create({ name: "Launch", config, shared: true });

    expect((await owner.taskView.list()).map((v) => v.name).sort()).toEqual([
      "Launch",
      "My focus",
    ]);
    expect((await member.taskView.list()).map((v) => v.name)).toEqual([
      "Launch",
    ]);
    expect(await outsider.taskView.list()).toEqual([]);
  });

  it("returns the saved settings unchanged", async () => {
    const [view] = (await member.taskView.list()).filter(
      (v) => v.name === "Launch",
    );

    expect(view!.config).toEqual(config);
    expect(view!.mine).toBe(false);
  });

  it("rejects settings that are not valid filters", async () => {
    await expect(
      owner.taskView.create({
        name: "Bad",
        config: { ...config, status: "nonsense" as never },
      }),
    ).rejects.toThrow();
    await expect(
      owner.taskView.create({
        name: "Huge",
        config: { ...config, search: "x".repeat(500) },
      }),
    ).rejects.toThrow();
  });

  it("allows one view per name for a person, and only the owner removes it", async () => {
    await expect(
      owner.taskView.create({ name: " launch ", config }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const [shared] = (await member.taskView.list()).filter(
      (v) => v.name === "Launch",
    );

    await expect(
      member.taskView.remove({ id: shared!.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await owner.taskView.remove({ id: shared!.id });
    expect(await member.taskView.list()).toEqual([]);
  });

  it("caps how many a person can keep", async () => {
    const list = await owner.taskView.list();

    for (let i = list.length; i < 50; i += 1) {
      await owner.taskView.create({ name: `View ${i}`, config });
    }

    await expect(
      owner.taskView.create({ name: "One too many", config }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
