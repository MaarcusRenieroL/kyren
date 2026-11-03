import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("the trash is only listed for people who can restore", () => {
  let restorer: Awaited<ReturnType<World["caller"]>>;
  let reader: Awaited<ReturnType<World["caller"]>>;

  beforeAll(async () => {
    const org = await world.org("Trash listing");
    const a = await world.userIn(org, "member", "Restorer");
    const b = await world.userIn(org, "member", "Reader");

    await world.doc(org, { title: "Live doc" });
    await world.doc(org, { title: "Trashed doc", deletedAt: new Date() });
    await world.override(org, b.user, "docs.restore", "deny");

    restorer = await world.caller(a.user, org);
    reader = await world.caller(b.user, org);
  });

  const titles = async (caller: typeof reader) =>
    (await caller.docs.getAll({ includeDeleted: true })).map((d) => d.title);

  it("lists the trash for someone who can restore", async () => {
    expect(await titles(restorer)).toContain("Trashed doc");
  });

  it("hides the trash from someone who cannot restore", async () => {
    const seen = await titles(reader);

    expect(seen).toContain("Live doc");
    expect(seen).not.toContain("Trashed doc");
  });

  it("applies to search too", async () => {
    const hits = await reader.docs.search({
      query: "doc",
      includeDeleted: true,
    });

    expect(hits.map((d) => d.title)).not.toContain("Trashed doc");
  });
});
