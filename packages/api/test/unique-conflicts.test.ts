import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("a lost race on a unique name is a conflict, not a crash", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;

  beforeAll(async () => {
    const org = await world.org("Unique race");
    const o = await world.userIn(org, "owner", "Race Owner");

    owner = await world.caller(o.user, org);
  });

  it("creating the same team twice at once yields one team and one CONFLICT", async () => {
    const results = await Promise.allSettled(
      [1, 2, 3].map(() =>
        owner.team.create({ name: "Platform", color: "blue" }),
      ),
    );
    const codes = results.flatMap((result) =>
      result.status === "rejected"
        ? [(result.reason as { code?: string }).code]
        : [],
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(codes.every((code) => code === "CONFLICT")).toBe(true);
  });
});
