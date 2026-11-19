import { describe, expect, it } from "vitest";

import type { El } from "../src/components/whiteboards/canvas/model";
import { mergeIn, restore } from "../src/components/whiteboards/canvas/sync";

const rect = (id: string, v: number, x = 0): El =>
  ({ id, type: "rect", x, y: 0, w: 10, h: 10, color: "ink", v }) as El;

describe("taking in the server's copy", () => {
  it("takes the server's copy on a tie, so two people end up with the same board", () => {
    const remote = new Map<string, number>();
    const merged = mergeIn(
      [rect("a", 4, 10)],
      [rect("a", 4, 99)],
      new Set(),
      remote,
    );

    expect(merged[0]!.x).toBe(99);
    expect(remote.get("a")).toBe(4);
  });

  it("leaves a shape alone while this person is dragging it", () => {
    const local = [rect("a", 2, 10)];

    expect(mergeIn(local, [rect("a", 5, 99)], new Set(["a"]), new Map())).toBe(
      local,
    );
  });
});

describe("undo", () => {
  it("undoes this person's change without deleting someone else's new shape", () => {
    const remote = new Map<string, number>();
    const before: El[] = [];
    // Ana draws a rect…
    let board: El[] = [rect("mine", 1)];
    // …then Ben's ellipse arrives from the server.
    board = mergeIn(board, [rect("bens", 1)], new Set(), remote);

    const undone = restore(before, board, remote);

    expect(undone.find((el) => el.id === "mine")?.deleted).toBe(true);
    expect(undone.find((el) => el.id === "bens")?.deleted).toBeUndefined();
  });

  it("doesn't roll back someone else's later edit to a shared shape", () => {
    const remote = new Map<string, number>();
    const snapshot = [rect("shared", 1, 0)];
    const board = mergeIn(
      [rect("shared", 1, 0)],
      [rect("shared", 2, 50)],
      new Set(),
      remote,
    );

    expect(restore(snapshot, board, remote)[0]!.x).toBe(50);
  });

  it("brings back this person's own deleted shape as a newer version", () => {
    const snapshot = [rect("a", 1, 7)];
    const board = [{ ...rect("a", 2), deleted: true }];
    const [back] = restore(snapshot, board, new Map());

    expect(back).toMatchObject({ x: 7, v: 3 });
    expect(back!.deleted).toBeUndefined();
  });
});
