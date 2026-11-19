import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("saving a doc someone else changed", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let admin: Awaited<ReturnType<World["caller"]>>;
  let docId: string;

  beforeAll(async () => {
    const org = await world.org("Doc conflict");
    const o = await world.userIn(org, "owner", "Doc Owner");
    const a = await world.userIn(org, "admin", "Doc Admin");
    const doc = await world.doc(org, { content: "start" });

    owner = await world.caller(o.user, org);
    admin = await world.caller(a.user, org);
    docId = doc.id;
  });

  it("refuses a save made from an out-of-date copy", async () => {
    const mine = await owner.docs.updateDocContent({
      id: docId,
      content: "first edit",
    });

    await admin.docs.updateDocContent({
      id: docId,
      content: "their edit",
    });

    await expect(
      owner.docs.updateDocContent({
        id: docId,
        content: "my second edit",
        expectedUpdatedAt: new Date(mine.updatedAt),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("accepts a save made from the latest copy, and saves without a guard as before", async () => {
    const latest = await admin.docs.updateDocContent({
      id: docId,
      content: "newest",
    });

    await expect(
      owner.docs.updateDocContent({
        id: docId,
        content: "built on newest",
        expectedUpdatedAt: new Date(latest.updatedAt),
      }),
    ).resolves.toMatchObject({ content: "built on newest" });

    await expect(
      owner.docs.updateDocContent({ id: docId, content: "unguarded" }),
    ).resolves.toMatchObject({ content: "unguarded" });
  });
});

describe("restoring an old version", () => {
  it("is refused over a newer change, and the next save builds on the restore", async () => {
    const org = await world.org("Doc restore");
    const o = await world.userIn(org, "owner", "Restorer");
    const a = await world.userIn(org, "admin", "Other editor");
    const doc = await world.doc(org, { content: "v1" });
    const owner = await world.caller(o.user, org);
    const admin = await world.caller(a.user, org);

    const seen = await owner.docs.updateDocContent({
      id: doc.id,
      content: "v2",
    });

    await admin.docs.updateDocContent({ id: doc.id, content: "their v3" });

    const history = await owner.docs.getVersionHistory({ id: doc.id });
    const v2 = history.find((version) => version.snippet === "v2")!;

    await expect(
      owner.docs.restoreVersion({
        id: doc.id,
        versionId: v2.id,
        expectedUpdatedAt: new Date(seen.updatedAt),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const current = await admin.docs.updateDocContent({
      id: doc.id,
      content: "v4",
    });
    const restored = await owner.docs.restoreVersion({
      id: doc.id,
      versionId: v2.id,
      expectedUpdatedAt: new Date(current.updatedAt),
    });

    expect(restored.content).toBe("v2");

    await expect(
      owner.docs.updateDocContent({
        id: doc.id,
        content: "v2 plus more",
        expectedUpdatedAt: new Date(restored.updatedAt),
      }),
    ).resolves.toMatchObject({ content: "v2 plus more" });
  });
});

describe("a doc whose stored time has microseconds", () => {
  it("accepts a guarded save from the copy the editor loaded", async () => {
    const org = await world.org("Doc precision");
    const o = await world.userIn(org, "owner", "Editor");
    // Inserted by the database clock, so `updatedAt` keeps microseconds.
    const doc = await world.doc(org, { content: "start" });
    const owner = await world.caller(o.user, org);
    const loaded = await owner.docs.getById({ id: doc.id });

    await expect(
      owner.docs.updateDocContent({
        id: doc.id,
        content: "first guarded edit",
        expectedUpdatedAt: new Date(loaded.updatedAt),
      }),
    ).resolves.toMatchObject({ content: "first guarded edit" });
  });
});
