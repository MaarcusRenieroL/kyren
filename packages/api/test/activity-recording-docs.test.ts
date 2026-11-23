import { db } from "@kyren/db";
import { and, eq } from "@kyren/db/drizzle";
import { activityEvents } from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fetchEvents as events } from "./helpers/activity-recording-helpers";
import { World, type TestOrg, type TestUser } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("activity recording: doc events and debounce", () => {
  let org: TestOrg;
  let owner: Awaited<ReturnType<World["caller"]>>;
  let memberUser: TestUser;
  let projectId: string;

  beforeAll(async () => {
    org = await world.org("Doc Activity Co");
    const o = await world.userIn(org, "owner", "Doc Owner");
    const m = await world.userIn(org, "member", "Doc Member");

    memberUser = m.user;
    owner = await world.caller(o.user, org);
    const project = await world.project(org, { name: "Doc Proj" });
    projectId = project.id;
  });

  it("records doc events and debounces edits per person", async () => {
    const doc = await owner.docs.create({
      projectId,
      title: "Plan",
      slug: "plan-doc",
    });

    expect((await events(org, "doc.created"))[0]).toMatchObject({
      targetType: "doc",
      targetId: doc.id,
      targetLabel: "Plan",
      projectId,
    });

    await owner.docs.updateDocTitle({ id: doc.id, title: "Plan v2" });
    await owner.docs.updateDocContent({ id: doc.id, content: "hello" });
    await owner.docs.updateDocContent({ id: doc.id, content: "hello again" });

    const edits = await events(org, "doc.updated");

    expect(edits).toHaveLength(1);
    expect(edits[0]!.metadata.changes).toEqual([
      { field: "title", from: "Plan", to: "Plan v2" },
    ]);

    const memberCaller = await world.caller(memberUser, org);

    await memberCaller.docs.updateDocContent({ id: doc.id, content: "mine" });
    expect(await events(org, "doc.updated")).toHaveLength(2);

    await owner.docs.createComment({ docId: doc.id, body: "note" });
    const [comment] = await events(org, "doc.comment_added");

    await owner.docs.resolveComment({
      id: comment!.metadata.commentId as string,
    });
    expect(await events(org, "doc.comment_resolved")).toHaveLength(1);

    await owner.docs.delete({ id: doc.id });
    await owner.docs.restore({ id: doc.id });
    expect(await events(org, "doc.trashed")).toHaveLength(1);
    expect((await events(org, "doc.restored"))[0]).toMatchObject({
      targetLabel: "Plan v2",
    });
  });

  it("allows another edit once the debounce window has passed", async () => {
    const doc = await owner.docs.create({
      title: "Window",
      slug: "window-doc",
    });

    await owner.docs.updateDocContent({ id: doc.id, content: "a" });
    await db
      .update(activityEvents)
      .set({ createdAt: new Date(Date.now() - 11 * 60 * 1000) })
      .where(
        and(
          eq(activityEvents.targetId, doc.id),
          eq(activityEvents.action, "doc.updated"),
        ),
      );
    await owner.docs.updateDocContent({ id: doc.id, content: "b" });

    expect(
      (await events(org, "doc.updated")).filter(
        (e: { targetId: string }) => e.targetId === doc.id,
      ),
    ).toHaveLength(2);
  });
});
