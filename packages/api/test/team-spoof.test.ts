import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("a call cannot claim a different team than its project's", () => {
  let member: Caller;
  let projectId: string;
  let otherTeamId: string;

  beforeAll(async () => {
    const org = await world.org("Team spoof");
    const m = await world.userIn(org, "member", "Spoofer");
    const teamB = await world.team(org);
    const teamA = await world.team(org);

    otherTeamId = teamA.id;
    projectId = (
      await world.project(org, { taskKeyPrefix: "TB", teamId: teamB.id })
    ).id;

    // Not allowed to create tasks anywhere in team B.
    await world.override(org, m.user, "tasks.create", "deny", {
      type: "team",
      id: teamB.id,
    });

    member = await world.caller(m.user, org);
  });

  it("is refused in the project's own team", async () => {
    await expect(
      member.task.createTask({ projectId, name: "Honest" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("is still refused when the input names another team", async () => {
    await expect(
      member.task.createTask({
        projectId,
        name: "Spoofed",
        teamId: otherTeamId,
      } as Parameters<typeof member.task.createTask>[0]),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("an unknown team id gives no scope at all", async () => {
    await expect(
      member.task.createTask({
        projectId,
        name: "Made-up team",
        teamId: "00000000-0000-0000-0000-000000000000",
      } as Parameters<typeof member.task.createTask>[0]),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("a malformed team id", () => {
  it("is a validation error, not a server error", async () => {
    const org = await world.org("Team spoof shape");
    const m = await world.userIn(org, "member", "Shape");
    const member = await world.caller(m.user, org);

    await expect(
      member.task.createTask({
        projectId: "not-a-uuid",
        name: "x",
        teamId: "not-a-uuid",
      } as Parameters<typeof member.task.createTask>[0]),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
