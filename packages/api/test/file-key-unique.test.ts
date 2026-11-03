import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("a stored object belongs to one file record", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let colleague: Awaited<ReturnType<World["caller"]>>;
  let orgId: string;

  beforeAll(async () => {
    const org = await world.org("Key unique");
    const o = await world.userIn(org, "owner", "Key Owner");
    const m = await world.userIn(org, "member", "Key Colleague");

    orgId = org.id;
    owner = await world.caller(o.user, org);
    colleague = await world.caller(m.user, org);
  });

  it("refuses to register the same storage key twice", async () => {
    const input = {
      name: "a.pdf",
      mimeType: "application/pdf",
      size: 100,
      storageKey: `${orgId}/same-key.pdf`,
    };

    await owner.files.libraryRegister(input);

    await expect(
      colleague.files.libraryRegister({ ...input, name: "mine.pdf" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
