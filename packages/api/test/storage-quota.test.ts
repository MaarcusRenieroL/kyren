import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => {
  delete process.env.STORAGE_LIMIT_BYTES;

  return world.cleanup();
});

describe("an organization has a storage limit", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let orgId: string;

  const register = (size: number) =>
    owner.files.libraryRegister({
      name: "f.pdf",
      mimeType: "application/pdf",
      size,
      storageKey: `${orgId}/${Math.random().toString(36).slice(2)}.pdf`,
    });

  beforeAll(async () => {
    process.env.STORAGE_LIMIT_BYTES = "10000";
    const org = await world.org("Quota");
    const o = await world.userIn(org, "owner", "Priya");

    orgId = org.id;
    owner = await world.caller(o.user, org);
  });

  it("reports usage and the limit", async () => {
    await register(4000);

    expect(await owner.files.usage()).toEqual({ used: 4000, limit: 10000 });
  });

  it("refuses an upload that would pass the limit, before and after the bytes", async () => {
    await expect(
      owner.files.libraryAuthorize({ size: 7000 }),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    await expect(register(7000)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("accepts a file that fits and frees space when one is deleted", async () => {
    const fits = await register(6000);

    await expect(register(1)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });

    await owner.files.remove({ id: fits.id });

    expect((await owner.files.usage()).used).toBe(4000);
    await expect(register(1)).resolves.toBeTruthy();
  });
});
