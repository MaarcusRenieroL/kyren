import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("who else is on a board", () => {
  it("lists the others looking at the board, never the caller", async () => {
    const org = await world.org("Board presence");
    const a = await world.userIn(org, "owner", "Ana Present");
    const b = await world.userIn(org, "member", "Ben Present");
    const ana = await world.caller(a.user, org);
    const ben = await world.caller(b.user, org);
    const { id } = await ana.whiteboard.create({ title: "Live" });

    expect(await ana.whiteboard.presence({ id })).toEqual([]);
    expect(
      await ben.whiteboard.presence({ id, cursor: { x: 120, y: 80 } }),
    ).toEqual([expect.objectContaining({ name: "Ana Present", cursor: null })]);
    // Ana sees Ben, and where his pointer is.
    expect(await ana.whiteboard.presence({ id })).toEqual([
      expect.objectContaining({
        name: "Ben Present",
        cursor: { x: 120, y: 80 },
      }),
    ]);
  });

  it("is closed to other organizations and to people who can't see boards", async () => {
    const org = await world.org("Board presence private");
    const a = await world.userIn(org, "owner", "Owner Private");
    const m = await world.userIn(org, "member", "No Boards");
    const ana = await world.caller(a.user, org);
    const { id } = await ana.whiteboard.create({ title: "Private" });
    const other = await world.org("Board presence elsewhere");
    const stranger = await world.caller(
      (await world.userIn(other, "owner", "Stranger")).user,
      other,
    );

    await expect(stranger.whiteboard.presence({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await world.override(org, m.user, "whiteboards.view", "deny");
    await expect(
      (await world.caller(m.user, org)).whiteboard.presence({ id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
