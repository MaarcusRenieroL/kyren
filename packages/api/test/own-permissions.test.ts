import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

/**
 * Members hold the "_own" permissions (manage their own events, delete their
 * own files and boards). These were asked without naming an owner, which the
 * engine always answers "no", so members couldn't touch their own things.
 */
describe("members can manage what they created, and only that", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let mia: Caller;
  let oz: Caller;

  beforeAll(async () => {
    org = await world.org("Own things");
    mia = await world.caller(
      (await world.userIn(org, "member", "Mia")).user,
      org,
    );
    oz = await world.caller(
      (await world.userIn(org, "member", "Oz")).user,
      org,
    );
  });

  const event = (title: string) => ({
    title,
    description: null,
    location: null,
    color: "blue" as const,
    allDay: false,
    startsAt: new Date("2031-01-10T09:00:00Z"),
    endsAt: new Date("2031-01-10T10:00:00Z"),
  });

  it("calendar: edit and delete your own event, not someone else's", async () => {
    const mine = await mia.calendar.create(event("Mia's sync"));
    const listed = await mia.calendar.list({
      from: new Date("2031-01-01T00:00:00Z"),
      to: new Date("2031-02-01T00:00:00Z"),
    });

    expect(listed.find((e) => e.id === mine.id)?.canManage).toBe(true);
    await expect(
      mia.calendar.update({ id: mine.id, data: event("Mia's sync, moved") }),
    ).resolves.toBeTruthy();
    await expect(
      oz.calendar.update({ id: mine.id, data: event("Hijacked") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(oz.calendar.remove({ id: mine.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(mia.calendar.remove({ id: mine.id })).resolves.toBeTruthy();
  });

  it("files: the library offers delete on your own files only", async () => {
    const own = await mia.files.libraryRegister({
      name: "mine.txt",
      mimeType: "text/plain",
      size: 10,
      storageKey: `${org.id}/own-${Date.now()}-a`,
    });
    const theirs = await oz.files.libraryRegister({
      name: "theirs.txt",
      mimeType: "text/plain",
      size: 10,
      storageKey: `${org.id}/own-${Date.now()}-b`,
    });
    const library = await mia.files.library();

    expect(library.find((f) => f.id === own.id)?.canManage).toBe(true);
    expect(library.find((f) => f.id === theirs.id)?.canManage).toBe(false);
  });

  it("whiteboards: the list offers rename and delete on your own boards", async () => {
    const { id: mine } = await mia.whiteboard.create({ title: "Mia's board" });
    const { id: theirs } = await oz.whiteboard.create({ title: "Oz's board" });
    const boards = await mia.whiteboard.list();

    expect(boards.find((b) => b.id === mine)?.canManage).toBe(true);
    expect(boards.find((b) => b.id === theirs)?.canManage).toBe(false);
    await expect(
      mia.whiteboard.rename({ id: mine, title: "Renamed" }),
    ).resolves.toEqual({ id: mine });
    await expect(oz.whiteboard.remove({ id: mine })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
