import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { chatChannels } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("search only finds what the caller can open", () => {
  let owner: Caller;
  let member: Caller;
  let org: Awaited<ReturnType<World["org"]>>;
  let hiddenProjectId: string;
  let privateChannelId: string;

  beforeAll(async () => {
    org = await world.org("Search scope");
    const o = await world.userIn(org, "owner", "Priya");
    const m = await world.userIn(org, "member", "Arjun");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);

    const open = await world.project(org, {
      name: "Zephyr open",
      taskKeyPrefix: "ZOP",
    });
    const hidden = await world.project(org, {
      name: "Zephyr secret",
      taskKeyPrefix: "ZSE",
      visibility: "private",
    });

    hiddenProjectId = hidden.id;
    await world.task(org, open, { taskNumber: 1, name: "Zephyr launch" });
    await world.task(org, hidden, { taskNumber: 1, name: "Zephyr layoffs" });
    await world.doc(org, { title: "Zephyr plan", projectId: open.id });
    await world.doc(org, { title: "Zephyr board memo", projectId: hidden.id });

    privateChannelId = (
      await db
        .insert(chatChannels)
        .values({
          organizationId: org.id,
          name: "zephyr-exec",
          visibility: "private",
        })
        .returning()
    )[0]!.id;
  });

  it("a member does not find tasks, docs or projects in a private project", async () => {
    const titles = (await member.search.query({ query: "zephyr" })).map(
      (hit) => hit.title,
    );

    expect(titles).toEqual(
      expect.arrayContaining(["Zephyr launch", "Zephyr plan", "Zephyr open"]),
    );
    expect(titles).not.toContain("Zephyr layoffs");
    expect(titles).not.toContain("Zephyr board memo");
    expect(titles).not.toContain("Zephyr secret");
    expect(titles).not.toContain("#zephyr-exec");

    const ownerTitles = (await owner.search.query({ query: "zephyr" })).map(
      (hit) => hit.title,
    );

    expect(ownerTitles).toContain("Zephyr layoffs");
  });

  it("lookup by key or id does not confirm hidden things exist", async () => {
    expect(await member.search.searchById({ query: "ZSE-1" })).toBeNull();
    expect(
      await member.search.searchById({ query: hiddenProjectId }),
    ).toBeNull();
    expect(
      await member.search.searchById({ query: privateChannelId }),
    ).toBeNull();
    expect((await owner.search.searchById({ query: "ZSE-1" }))?.title).toBe(
      "Zephyr layoffs",
    );
  });

  it("a module that is off contributes nothing", async () => {
    await world.setModule(org, "docs", false);

    try {
      const hits = await owner.search.query({ query: "zephyr" });

      expect(hits.some((hit) => hit.type === "doc")).toBe(false);
    } finally {
      await world.setModule(org, "docs", true);
    }
  });

  it("% and _ are matched literally", async () => {
    expect(await owner.search.query({ query: "%" })).toEqual([]);
  });
});

describe("search for someone denied every area", () => {
  it("returns nothing, even for exact keys", async () => {
    const org = await world.org("Search denial");
    const o = await world.userIn(org, "owner", "Owner");
    const m = await world.userIn(org, "member", "Denied");
    const project = await world.project(org, {
      name: "Yonder",
      taskKeyPrefix: "YON",
    });

    await world.task(org, project, { taskNumber: 1, name: "Yonder task" });
    await world.doc(org, { title: "Yonder doc", projectId: project.id });
    for (const key of [
      "tasks.view",
      "projects.view",
      "docs.view",
      "chat.view",
    ]) {
      await world.override(org, m.user, key, "deny");
    }

    const denied = await world.caller(m.user, org);
    const owner = await world.caller(o.user, org);

    expect(await denied.search.query({ query: "yonder" })).toEqual([]);
    expect(await denied.search.searchById({ query: "YON-1" })).toBeNull();
    expect(
      (await owner.search.query({ query: "yonder" })).length,
    ).toBeGreaterThan(0);
  });
});
