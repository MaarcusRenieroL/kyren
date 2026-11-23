import { afterAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { meetings } from "@kyren/db/schema";

import { runChatJobs } from "../src/server/chat-jobs";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const soon = () => new Date(Date.now() + 10 * 60_000).toISOString();

describe("background work run for one organization", () => {
  it("only touches that organization's due items", async () => {
    const mine = await world.org("Jobs mine");
    const theirs = await world.org("Jobs theirs");
    const a = await world.userIn(mine, "owner", "Mine");
    const b = await world.userIn(theirs, "owner", "Theirs");
    const ours = await (
      await world.caller(a.user, mine)
    ).meeting.create({
      title: "Ours",
      startsAt: soon(),
      durationMinutes: 30,
      attendeeUserIds: [],
    });
    const other = await (
      await world.caller(b.user, theirs)
    ).meeting.create({
      title: "Theirs",
      startsAt: soon(),
      durationMinutes: 30,
      attendeeUserIds: [],
    });

    await runChatJobs(db as never, { organizationId: mine.id });

    const reminded = async (id: string) =>
      (await db.select().from(meetings).where(eq(meetings.id, id)))[0]!
        .reminderSentAt;

    expect(await reminded(ours.id)).not.toBeNull();
    expect(await reminded(other.id)).toBeNull();

    // Leave nothing due behind: another file's global sweep would pick it up.
    await db
      .update(meetings)
      .set({ reminderSentAt: new Date() })
      .where(eq(meetings.id, other.id));
  });
});

describe("meetings on the calendar grid", () => {
  it("shows the caller's meetings in the window, and nobody else's", async () => {
    const org = await world.org("Grid meetings");
    const a = await world.userIn(org, "owner", "Ana");
    const b = await world.userIn(org, "member", "Ben");
    const c = await world.userIn(org, "member", "Cy");
    const ana = await world.caller(a.user, org);
    const cy = await world.caller(c.user, org);
    const at = new Date(Date.now() + 3 * 86_400_000);

    await ana.meeting.create({
      title: "Ana and Ben",
      startsAt: at.toISOString(),
      durationMinutes: 30,
      attendeeUserIds: [b.user.id],
    });

    const window = {
      from: new Date(at.getTime() - 86_400_000).toISOString(),
      to: new Date(at.getTime() + 86_400_000).toISOString(),
    };

    expect((await ana.meeting.between(window)).map((m) => m.title)).toEqual([
      "Ana and Ben",
    ]);
    expect(await cy.meeting.between(window)).toEqual([]);

    await world.override(org, c.user, "calendar.view", "deny");

    await expect(
      (await world.caller(c.user, org)).meeting.between(window),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
