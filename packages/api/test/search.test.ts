import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { chatChannels, docs, projects, tasks } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("search router", () => {
  let caller: Awaited<ReturnType<World["caller"]>>;
  let orgId: string;

  beforeAll(async () => {
    const org = await world.org("Search Org");
    const member = await world.userIn(org, "member", "Search Member");
    orgId = org.id;
    caller = await world.caller(member.user, org);

    const [proj] = await db
      .insert(projects)
      .values({
        organizationId: orgId,
        name: "Quantum Leap",
        slug: "quantum-leap",
        taskKeyPrefix: "QL",
      })
      .returning();

    await db.insert(tasks).values({
      organizationId: orgId,
      projectId: proj!.id,
      name: "Assemble particle collider",
      key: "QL-1",
      taskNumber: 1,
    });

    await db.insert(docs).values({
      organizationId: orgId,
      title: "Quantum Physics Architecture",
      slug: "quantum-physics-arch",
      content: "Particle specs and collider tolerances.",
    });

    await db.insert(chatChannels).values({
      organizationId: orgId,
      name: "quantum-dev",
      topic: "Quantum engineering chatter",
      visibility: "public",
    });
  });

  it("finds entities via searchById", async () => {
    const taskResult = await caller.search.searchById({ query: "QL-1" });
    expect(taskResult).toMatchObject({
      type: "task",
      key: "QL-1",
      title: "Assemble particle collider",
      href: "/tasks/QL-1",
    });

    const docResult = await caller.search.searchById({
      query: "quantum-physics-arch",
    });
    expect(docResult).toMatchObject({
      type: "doc",
      title: "Quantum Physics Architecture",
      href: "/docs/quantum-physics-arch",
    });

    const channelResult = await caller.search.searchById({
      query: "#quantum-dev",
    });
    expect(channelResult).toMatchObject({
      type: "channel",
      title: "#quantum-dev",
      href: "/chat/quantum-dev",
    });
  });

  it("finds matching items across modules with query", async () => {
    const results = await caller.search.query({ query: "Quantum" });
    expect(results.length).toBeGreaterThanOrEqual(3);
    const types = results.map((r) => r.type);
    expect(types).toContain("project");
    expect(types).toContain("doc");
    expect(types).toContain("channel");
  });
});
