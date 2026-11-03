import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@zentro/db";

import { setMeetingMailer, type MeetingMail } from "../src/server/meeting-mail";
import { sendDueMeetingReminders } from "../src/server/meeting-reminders";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const minutes = (n: number) => new Date(Date.now() + n * 60_000);

describe("meeting emails", () => {
  let owner: Caller;
  let guest: Caller;
  let decliner: Caller;
  let ownerEmail: string;
  let guestEmail: string;
  let declinerEmail: string;
  let guestId: string;
  let declinerId: string;
  let sent: MeetingMail[] = [];

  beforeAll(async () => {
    const org = await world.org("Meeting mail");
    const o = await world.userIn(org, "owner", "Mail Owner");
    const g = await world.userIn(org, "member", "Mail Guest");
    const d = await world.userIn(org, "member", "Mail Decliner");

    owner = await world.caller(o.user, org);
    guest = await world.caller(g.user, org);
    decliner = await world.caller(d.user, org);
    ownerEmail = o.user.email;
    guestEmail = g.user.email;
    declinerEmail = d.user.email;
    guestId = g.user.id;
    declinerId = d.user.id;
  });

  beforeEach(() => {
    sent = [];
    setMeetingMailer(async (mail) => {
      sent.push(mail);
    });
  });

  afterAll(() => setMeetingMailer(null));

  it("emails the invitees, but not the organiser, when a meeting is scheduled", async () => {
    await owner.meeting.create({
      title: "Kickoff",
      startsAt: minutes(300),
      durationMinutes: 30,
      attendeeUserIds: [guestId, declinerId],
    });

    expect(sent.map((m) => m.to).sort()).toEqual(
      [guestEmail, declinerEmail].sort(),
    );
    expect(sent.every((m) => m.kind === "invite")).toBe(true);
    expect(sent[0]!.title).toBe("Kickoff");
    expect(sent[0]!.organizer).toBe("Mail Owner");
    // The email links to the meeting page, never to the video room itself.
    expect(sent[0]!.path).toMatch(/^\/calendar\/meetings\/[0-9a-f-]{36}$/);
  });

  it("emails the other attendees when it is canceled, and a failing mailer breaks nothing", async () => {
    const { id } = await owner.meeting.create({
      title: "Cancel me",
      startsAt: minutes(300),
      durationMinutes: 30,
      attendeeUserIds: [guestId],
    });

    sent = [];
    await owner.meeting.cancel({ id });

    expect(sent.map((m) => [m.kind, m.to])).toEqual([["cancel", guestEmail]]);

    setMeetingMailer(async () => {
      throw new Error("mail is down");
    });

    await expect(
      owner.meeting.create({
        title: "Still works",
        startsAt: minutes(300),
        durationMinutes: 30,
        attendeeUserIds: [guestId],
      }),
    ).resolves.toBeDefined();
  });

  it("reminds attendees once, shortly before the start, and skips those who said no", async () => {
    const soon = await owner.meeting.create({
      title: "Starting soon",
      startsAt: minutes(10),
      durationMinutes: 30,
      attendeeUserIds: [guestId, declinerId],
    });
    const later = await owner.meeting.create({
      title: "Much later",
      startsAt: minutes(180),
      durationMinutes: 30,
      attendeeUserIds: [guestId],
    });
    const canceled = await owner.meeting.create({
      title: "Called off",
      startsAt: minutes(10),
      durationMinutes: 30,
      attendeeUserIds: [guestId],
    });

    await decliner.meeting.respond({ id: soon.id, response: "no" });
    await owner.meeting.cancel({ id: canceled.id });
    sent = [];

    expect(await sendDueMeetingReminders(db)).toBeGreaterThanOrEqual(1);

    const reminders = sent.filter((m) => m.kind === "reminder");

    expect(reminders.map((m) => m.title)).toEqual([
      "Starting soon",
      "Starting soon",
    ]);
    expect(reminders.map((m) => m.to).sort()).toEqual(
      [ownerEmail, guestEmail].sort(),
    );

    sent = [];
    await sendDueMeetingReminders(db);
    expect(sent).toEqual([]);
    expect(await guest.meeting.get({ id: later.id })).toBeTruthy();
  });
});
