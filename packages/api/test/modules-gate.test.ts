import { db } from "@kyren/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEnabledModulesLoader } from "../src/server/modules";
import { World, type TestOrg, type TestUser } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

async function freshOrg(name: string) {
  const org = await world.org(name);
  const { user: owner } = await world.userIn(org, "owner", `${name} owner`);
  const { user: member } = await world.userIn(org, "member", `${name} member`);

  return { org, owner, member };
}

describe("moduleProcedure", () => {
  let org: TestOrg;
  let owner: TestUser;

  beforeAll(async () => {
    ({ org, owner } = await freshOrg("Guarded"));
    const project = await world.project(org);
    await world.task(org, project, { taskNumber: 1 });
    await world.doc(org, { slug: "kept-doc" });
  });

  it("works while the module is enabled (default, no rows)", async () => {
    const caller = await world.caller(owner, org);

    await expect(caller.task.getTasksByOrgId({})).resolves.toHaveLength(1);
    await expect(caller.docs.getAll({})).resolves.toHaveLength(1);
    await expect(caller.project.getProjectsByOrgId()).resolves.toHaveLength(1);
  });

  it("rejects with FORBIDDEN 'Module disabled' once the module is off", async () => {
    await world.setModule(org, "tasks", false);
    const caller = await world.caller(owner, org);

    await expect(caller.task.getTasksByOrgId({})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Module disabled",
    });
    await expect(
      caller.task.createTask({ projectId: crypto.randomUUID(), name: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Module disabled" });
    await expect(
      caller.comment.getTaskComments({ taskKey: "PA-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Module disabled" });
    await expect(
      caller.activity.getTaskActivityEvents({ taskKey: "PA-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Module disabled" });
  });

  it("leaves other modules and shared procedures working", async () => {
    const caller = await world.caller(owner, org);

    await expect(caller.docs.getAll({})).resolves.toHaveLength(1);
    await expect(caller.project.getProjectsByOrgId()).resolves.toHaveLength(1);
    await expect(caller.member.getMembers()).resolves.toHaveLength(2);
    await expect(caller.team.getAll()).resolves.toBeDefined();
  });

  it("checks the module before permissions on authorized procedures", async () => {
    await world.setModule(org, "docs", false);
    const caller = await world.caller(owner, org);

    await expect(
      caller.docs.create({ title: "x", slug: "x-doc" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Module disabled" });
    await expect(caller.docs.search({ query: "k" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Module disabled",
    });
  });

  it("works again, with the data intact, after re-enabling", async () => {
    await world.setModule(org, "tasks", true);
    await world.setModule(org, "docs", true);
    const caller = await world.caller(owner, org);

    const taskList = await caller.task.getTasksByOrgId({});
    expect(taskList).toHaveLength(1);
    expect(taskList[0]!.key).toBe("PA-1");

    const docList = await caller.docs.getAll({});
    expect(docList.map((doc) => doc.slug)).toEqual(["kept-doc"]);
  });

  it("reflects module changes on the next call", async () => {
    const { org: other, owner: otherOwner } = await freshOrg("Reflect");
    const caller = await world.caller(otherOwner, other);

    await expect(caller.docs.getAll({})).resolves.toBeDefined();
    await world.setModule(other, "docs", false);
    await expect(caller.docs.getAll({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("createEnabledModulesLoader", () => {
  it("queries once per request and then serves the cached set", async () => {
    const { org } = await freshOrg("Memoized");
    const load = createEnabledModulesLoader(db, org.id);

    const first = await load();
    await world.setModule(org, "docs", false);
    const second = await load();

    expect(first.has("docs")).toBe(true);
    expect(second).toBe(first);
    expect((await createEnabledModulesLoader(db, org.id)()).has("docs")).toBe(
      false,
    );
  });

  it("returns an empty set without an organization", async () => {
    expect([...(await createEnabledModulesLoader(db, null)())]).toEqual([]);
  });
});
