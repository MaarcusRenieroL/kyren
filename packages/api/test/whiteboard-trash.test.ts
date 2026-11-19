import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { activityEvents } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("the whiteboard trash", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Caller;
  let member: Caller;
  let other: Caller;

  beforeAll(async () => {
    org = await world.org("Board trash");
    owner = await world.caller(
      (await world.userIn(org, "owner", "Owner")).user,
      org,
    );
    // Members may delete only boards they created.
    member = await world.caller(
      (await world.userIn(org, "member", "Mia")).user,
      org,
    );
    other = await world.caller(
      (await world.userIn(org, "member", "Oz")).user,
      org,
    );
  });

  it("moves a deleted board to the trash, where nobody can draw on it, and back", async () => {
    const { id } = await member.whiteboard.create({ title: "Roadmap" });
    await member.whiteboard.get({ id });

    await member.whiteboard.remove({ id });

    expect((await member.whiteboard.list()).map((b) => b.id)).not.toContain(id);
    expect((await member.whiteboard.trash()).map((b) => b.id)).toContain(id);
    await expect(member.whiteboard.get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      member.whiteboard.save({ id, elements: [] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await member.whiteboard.restore({ id });
    await expect(member.whiteboard.get({ id })).resolves.toMatchObject({
      title: "Roadmap",
    });

    const restored = await db
      .select({ id: activityEvents.id })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.organizationId, org.id),
          eq(activityEvents.action, "whiteboard.restored"),
        ),
      );

    expect(restored).toHaveLength(1);
  });

  it("restores only what the caller could have deleted", async () => {
    const { id: mias } = await member.whiteboard.create({ title: "Mia's" });

    await member.whiteboard.remove({ id: mias });

    // Oz may delete only his own, so he neither sees nor restores Mia's.
    expect((await other.whiteboard.trash()).map((b) => b.id)).not.toContain(
      mias,
    );
    await expect(other.whiteboard.restore({ id: mias })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // The owner may delete any board, so may restore it.
    expect((await owner.whiteboard.trash()).map((b) => b.id)).toContain(mias);
    await expect(owner.whiteboard.restore({ id: mias })).resolves.toEqual({
      id: mias,
    });
    // A live board isn't in the trash.
    await expect(owner.whiteboard.restore({ id: mias })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("is closed to someone who may not see boards", async () => {
    const blocked = await world.userIn(org, "member", "No Boards");

    await world.override(org, blocked.user, "whiteboards.view", "deny");
    await expect(
      (await world.caller(blocked.user, org)).whiteboard.trash(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
