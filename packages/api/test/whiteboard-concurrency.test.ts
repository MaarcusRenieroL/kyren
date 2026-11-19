import { afterAll, describe, expect, it } from "vitest";

import { mergeBoard } from "../src/server/routers/whiteboard";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const shape = (id: string, v = 1, extra: Record<string, unknown> = {}) => ({
  id,
  type: "rect" as const,
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  color: "#112233",
  v,
  ...extra,
});

describe("two people drawing on one board", () => {
  it("keeps both people's shapes when they save at the same moment", async () => {
    const org = await world.org("Board race");
    const a = await world.userIn(org, "owner", "Ana");
    const b = await world.userIn(org, "member", "Ben");
    const ana = await world.caller(a.user, org);
    const ben = await world.caller(b.user, org);
    const { id } = await ana.whiteboard.create({ title: "Plan" });

    await Promise.all([
      ana.whiteboard.save({ id, elements: [shape("ana")] }),
      ben.whiteboard.save({ id, elements: [shape("ben")] }),
    ]);

    expect(
      (await ana.whiteboard.get({ id })).elements.map((el) => el.id).sort(),
    ).toEqual(["ana", "ben"]);
  });

  it("keeps the newest version of a shape, and a deletion sticks", async () => {
    const org = await world.org("Board versions");
    const a = await world.userIn(org, "owner", "Ana");
    const ana = await world.caller(a.user, org);
    const { id } = await ana.whiteboard.create({ title: "Versions" });

    await ana.whiteboard.save({ id, elements: [shape("box", 3, { x: 30 })] });

    // A stale copy (version 2) saved late does not undo the newer move.
    const late = await ana.whiteboard.save({
      id,
      elements: [shape("box", 2, { x: 20 })],
    });

    expect(late.elements).toEqual([expect.objectContaining({ x: 30 })]);

    // Deleting is a newer version marked deleted; an old copy can't revive it.
    await ana.whiteboard.save({
      id,
      elements: [shape("box", 4, { deleted: true })],
    });
    await ana.whiteboard.save({ id, elements: [shape("box", 3, { x: 30 })] });
    expect((await ana.whiteboard.get({ id })).elements).toEqual([
      expect.objectContaining({ id: "box", deleted: true }),
    ]);
  });
});

describe("mergeBoard", () => {
  it("keeps the stored copy on a tie, so a repeated save changes nothing", () => {
    expect(
      mergeBoard([shape("a", 2, { x: 1 })], [shape("a", 2, { x: 9 })]),
    ).toEqual([expect.objectContaining({ x: 1 })]);
  });
});

describe("renaming a board", () => {
  it("doesn't get in the way of the next save", async () => {
    const org = await world.org("Board rename");
    const a = await world.userIn(org, "owner", "Ana");
    const ana = await world.caller(a.user, org);
    const { id } = await ana.whiteboard.create({ title: "Old" });

    await ana.whiteboard.rename({ id, title: "New" });

    await expect(
      ana.whiteboard.save({ id, elements: [shape("after-rename")] }),
    ).resolves.toMatchObject({ elements: [expect.anything()] });
  });
});
