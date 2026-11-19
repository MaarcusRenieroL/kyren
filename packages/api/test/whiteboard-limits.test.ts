import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

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

describe("whiteboard access and limits", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let ana: Caller;
  let ben: Caller;
  let outsider: Caller;
  let benUser: Awaited<ReturnType<World["userIn"]>>["user"];
  let boardId: string;

  beforeAll(async () => {
    org = await world.org("Board limits");

    const a = await world.userIn(org, "owner", "Ana Board");
    const b = await world.userIn(org, "member", "Ben Board");
    const other = await world.org("Board limits elsewhere");
    const x = await world.userIn(other, "owner", "Board Outsider");

    ana = await world.caller(a.user, org);
    ben = await world.caller(b.user, org);
    outsider = await world.caller(x.user, other);
    benUser = b.user;
    boardId = (await ana.whiteboard.create({ title: "Limits" })).id;
  });

  it("keeps a board inside its organization", async () => {
    await expect(
      outsider.whiteboard.get({ id: boardId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      outsider.whiteboard.save({ id: boardId, elements: [shape("x")] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      outsider.whiteboard.version({ id: boardId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("moves the version when the drawing changes", async () => {
    const before = await ana.whiteboard.version({ id: boardId });
    const saved = await ana.whiteboard.save({
      id: boardId,
      elements: [shape("moved", 1)],
    });
    const after = await ben.whiteboard.version({ id: boardId });

    expect(after.updatedAt).toBe(saved.savedAt);
    expect(after.updatedAt).not.toBe(before.updatedAt);
  });

  it("signs a comment with the person who pinned it, whatever the editor sends", async () => {
    await ben.whiteboard.save({
      id: boardId,
      elements: [
        {
          ...shape("note", 1),
          type: "comment",
          text: "Looks good",
          author: "Ana Board",
        },
      ],
    });
    // Someone else editing the comment later doesn't take it over.
    await ana.whiteboard.save({
      id: boardId,
      elements: [
        {
          ...shape("note", 2),
          type: "comment",
          text: "Looks good!",
          author: "Ana Board",
        },
      ],
    });

    const note = (await ana.whiteboard.get({ id: boardId })).elements.find(
      (el) => el.id === "note",
    );

    expect(note).toMatchObject({ author: "Ben Board", text: "Looks good!" });
  });

  it("keeps deleted shapes as small markers that free their room", async () => {
    const points = Array.from({ length: 5000 }, (_, i) => i);
    const strokes = Array.from({ length: 20 }, (_, i) =>
      shape(`stroke-${i}`, 1, { type: "pen", points }),
    );

    await ana.whiteboard.save({ id: boardId, elements: strokes });

    // The board holds 100,000 points: full. Erasing them makes room again.
    const erased = await ana.whiteboard.save({
      id: boardId,
      elements: strokes.map((el) => ({ ...el, v: 2, deleted: true })),
    });

    expect(
      erased.elements.find((el) => el.id === "stroke-0"),
    ).not.toHaveProperty("points");
    await expect(
      ana.whiteboard.save({
        id: boardId,
        elements: [shape("after", 1, { type: "pen", points })],
      }),
    ).resolves.toBeTruthy();
  });

  it("refuses a board that grows too large with a clear error, not a crash", async () => {
    const points = Array.from({ length: 5000 }, (_, i) => i);
    const many = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) =>
        shape(`${prefix}-${i}`, 1, { type: "pen", points }),
      );
    const { id } = await ana.whiteboard.create({ title: "Crowded" });

    // Each save fits by itself; together they are over the budget.
    await ana.whiteboard.save({ id, elements: many("a", 15) });
    await expect(
      ben.whiteboard.save({ id, elements: many("b", 15) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses versions beyond the cap", async () => {
    await expect(
      ana.whiteboard.save({ id: boardId, elements: [shape("huge", 1e300)] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("needs the right to view boards to check their version", async () => {
    const viewerless = await world.userIn(org, "member", "No Boards");

    await world.override(org, viewerless.user, "whiteboards.view", "deny");

    const denied = await world.caller(viewerless.user, org);

    await expect(
      denied.whiteboard.version({ id: boardId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("needs the right to edit boards to create or draw", async () => {
    await world.override(org, benUser, "whiteboards.edit", "deny");

    const denied = await world.caller(benUser, org);

    await expect(
      denied.whiteboard.create({ title: "Nope" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      denied.whiteboard.save({ id: boardId, elements: [shape("nope")] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
