import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const inAnHour = () => new Date(Date.now() + 3_600_000);

describe("meetings", () => {
  let owner: Caller;
  let guest: Caller;
  let bystander: Caller;
  let outsider: Caller;
  let guestId: string;
  let outsiderId: string;
  let meetingId: string;

  beforeAll(async () => {
    const org = await world.org("Meetings");
    const o = await world.userIn(org, "owner", "Meet Owner");
    const g = await world.userIn(org, "member", "Meet Guest");
    const b = await world.userIn(org, "member", "Meet Bystander");
    const other = await world.org("Meetings elsewhere");
    const x = await world.userIn(other, "owner", "Meet Outsider");

    owner = await world.caller(o.user, org);
    guest = await world.caller(g.user, org);
    bystander = await world.caller(b.user, org);
    outsider = await world.caller(x.user, other);
    guestId = g.user.id;
    outsiderId = x.user.id;
  });

  it("schedules a meeting with an agenda and invites people of the organisation", async () => {
    const created = await owner.meeting.create({
      title: "Planning",
      agenda: "1. Scope\n2. Dates",
      startsAt: inAnHour(),
      durationMinutes: 30,
      attendeeUserIds: [guestId],
    });

    meetingId = created.id;

    const meeting = await owner.meeting.get({ id: meetingId });

    expect(meeting.title).toBe("Planning");
    expect(meeting.attendees.map((a) => a.name).sort()).toEqual([
      "Meet Guest",
      "Meet Owner",
    ]);
    expect(
      meeting.attendees.find((a) => a.name === "Meet Guest")?.response,
    ).toBe("invited");
    expect(meeting.joinUrl).toMatch(/^https:\/\/.+\/kyren-[0-9a-f]{24}$/);
  });

  it("rejects invitees from other organisations, bad lengths and times in the past", async () => {
    await expect(
      owner.meeting.create({
        title: "Leaky",
        startsAt: inAnHour(),
        durationMinutes: 30,
        attendeeUserIds: [outsiderId],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.meeting.create({
        title: "Too long",
        startsAt: inAnHour(),
        durationMinutes: 9999,
        attendeeUserIds: [],
      }),
    ).rejects.toBeDefined();
    await expect(
      owner.meeting.create({
        title: "Yesterday",
        startsAt: new Date(Date.now() - 86_400_000),
        durationMinutes: 30,
        attendeeUserIds: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("shows a meeting, its notes and its join link only to the people invited", async () => {
    expect((await guest.meeting.get({ id: meetingId })).joinUrl).toBeTruthy();
    expect(
      (await guest.meeting.list({ when: "upcoming" })).map((m) => m.title),
    ).toEqual(["Planning"]);

    await expect(
      bystander.meeting.get({ id: meetingId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(outsider.meeting.get({ id: meetingId })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    expect(await bystander.meeting.list({ when: "upcoming" })).toEqual([]);
  });

  it("lets an invitee answer, and nobody else", async () => {
    await guest.meeting.respond({ id: meetingId, response: "yes" });

    expect(
      (await owner.meeting.get({ id: meetingId })).attendees.find(
        (a) => a.name === "Meet Guest",
      )?.response,
    ).toBe("yes");
    await expect(
      bystander.meeting.respond({ id: meetingId, response: "yes" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets attendees keep shared notes, and keeps them from outsiders", async () => {
    await guest.meeting.saveNotes({
      id: meetingId,
      notes: "Agreed: ship Friday",
    });

    expect((await owner.meeting.get({ id: meetingId })).notes).toBe(
      "Agreed: ship Friday",
    );
    await expect(
      bystander.meeting.saveNotes({ id: meetingId, notes: "hijack" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("explains that AI notes need an administrator to turn AI on", async () => {
    await expect(
      guest.meeting.summarize({ id: meetingId }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("lets only the organiser cancel, and a cancelled meeting takes no more notes", async () => {
    await expect(guest.meeting.cancel({ id: meetingId })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
    await owner.meeting.cancel({ id: meetingId });

    expect((await owner.meeting.get({ id: meetingId })).status).toBe(
      "canceled",
    );
    await expect(
      guest.meeting.saveNotes({ id: meetingId, notes: "late" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
