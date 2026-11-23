import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { whiteboards } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("whiteboard.get", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let orgId: string;

  beforeAll(async () => {
    const org = await world.org("Board org");
    const o = await world.userIn(org, "owner", "Board Owner");

    orgId = org.id;
    owner = await world.caller(o.user, org);
  });

  it("returns the drawing as saved", async () => {
    const [board] = await db
      .insert(whiteboards)
      .values({ organizationId: orgId, title: "Fine", elements: [] })
      .returning();

    await expect(
      owner.whiteboard.get({ id: board!.id }),
    ).resolves.toMatchObject({ elements: [] });
  });

  it("reports damaged data instead of showing an empty board that would overwrite it", async () => {
    const [board] = await db
      .insert(whiteboards)
      .values({
        organizationId: orgId,
        title: "Broken",
        elements: [{ nonsense: true }],
      })
      .returning();

    await expect(owner.whiteboard.get({ id: board!.id })).rejects.toMatchObject(
      { code: "INTERNAL_SERVER_ERROR" },
    );
  });
});
