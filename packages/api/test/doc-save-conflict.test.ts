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
