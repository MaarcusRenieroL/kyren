import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { meetings, tasks } from "@kyren/db/schema";

import { actionItemsOf } from "../src/server/meeting-actions";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("action items in a recap", () => {
  it("reads the bullets under 'Action items:' and nothing else", () => {
    const summary = [
      "We agreed on the plan.",
      "",
      "Decisions:",
      "- Ship Friday",
      "",
      "Action items:",
      "- Priya to write the spec",
      "* Sam: book the venue",
      "• Check the budget",
      "",
      "Other:",
      "- Not an action",
    ].join("\n");

    expect(actionItemsOf(summary)).toEqual([
      "Priya to write the spec",
      "Sam: book the venue",
      "Check the budget",
    ]);
    expect(actionItemsOf(null)).toEqual([]);
    expect(actionItemsOf("No bullets here")).toEqual([]);
  });
});

describe("turning action items into tasks", () => {
  let owner: Caller;
  let bystander: Caller;
  let meetingId: string;
  let projectId: string;

  beforeAll(async () => {
    const org = await world.org("Meeting actions");
    const o = await world.userIn(org, "owner", "Act Owner");
    const b = await world.userIn(org, "member", "Act Bystander");
    const project = await world.project(org, { taskKeyPrefix: "MA" });

    owner = await world.caller(o.user, org);
    bystander = await world.caller(b.user, org);
    projectId = project.id;

    const created = await owner.meeting.create({
      title: "Retro",
      startsAt: new Date(Date.now() + 3_600_000),
      durationMinutes: 30,
      attendeeUserIds: [],
    });

    meetingId = created.id;
    await db
      .update(meetings)
      .set({ summary: "Action items:\n- Fix the build\n- Write the notes" })
      .where(eq(meetings.id, meetingId));
  });

  it("offers the recap's action items on the meeting", async () => {
    expect((await owner.meeting.get({ id: meetingId })).actionItems).toEqual([
      "Fix the build",
      "Write the notes",
    ]);
  });

  it("creates one task per item in the chosen project", async () => {
    const result = await owner.meeting.createTasks({
      id: meetingId,
      projectId,
      titles: ["Fix the build", "Write the notes"],
    });

    expect(result.keys).toEqual(["MA-1", "MA-2"]);

    const made = await db.select({ name: tasks.name }).from(tasks);

    expect(made.map((t) => t.name)).toEqual(
      expect.arrayContaining(["Fix the build", "Write the notes"]),
    );
  });

  it("keeps the meeting private and the request sensible", async () => {
    await expect(
      bystander.meeting.createTasks({
        id: meetingId,
        projectId,
        titles: ["Sneaky"],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      owner.meeting.createTasks({ id: meetingId, projectId, titles: [] }),
    ).rejects.toBeDefined();
    await expect(
      owner.meeting.createTasks({
        id: meetingId,
        projectId,
        titles: Array.from({ length: 21 }, (_, i) => `Task ${i}`),
      }),
    ).rejects.toBeDefined();
  });
});
