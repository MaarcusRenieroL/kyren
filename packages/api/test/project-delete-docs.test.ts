import { afterAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq, or } from "@zentro/db/drizzle";
import { docs, workLinks } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("deleting a project", () => {
  it("deletes its docs instead of leaving them visible to everyone", async () => {
    const org = await world.org("Delete project docs");
    const o = await world.userIn(org, "owner", "Priya");
    const m = await world.userIn(org, "member", "Arjun");
    const owner = await world.caller(o.user, org);
    const member = await world.caller(m.user, org);
    const hidden = await world.project(org, {
      taskKeyPrefix: "DEL",
      visibility: "private",
    });
    const task = await world.task(org, hidden, { taskNumber: 1 });
    const doc = await world.doc(org, {
      title: "Quokka acquisition memo",
      projectId: hidden.id,
    });

    await db.insert(workLinks).values({
      organizationId: org.id,
      sourceType: "doc",
      sourceId: doc.id,
      targetType: "task",
      targetId: task.id,
      kind: "mentions",
      via: "content",
    });

    await owner.project.deleteProject({ slug: hidden.slug });

    expect(
      await db.select().from(docs).where(eq(docs.id, doc.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(workLinks)
        .where(
          or(eq(workLinks.sourceId, doc.id), eq(workLinks.targetId, task.id)),
        ),
    ).toHaveLength(0);

    const hits = await member.search.query({ query: "quokka" });

    expect(hits).toEqual([]);
  });
});
