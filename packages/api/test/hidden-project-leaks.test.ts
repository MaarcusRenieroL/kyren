import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { teamMembers, tasks } from "@zentro/db/schema";
import { eq } from "@zentro/db/drizzle";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("team workload, automation lists and SLA escalation respect project visibility", () => {
  let owner: Caller;
  let arjun: Caller;
  let teamId: string;
  let hiddenId: string;
  let trashedTaskId: string;
  let openTaskId: string;

  beforeAll(async () => {
    const org = await world.org("Hidden leaks");
    const o = await world.userIn(org, "owner", "Priya");
    const a = await world.userIn(org, "member", "Arjun");
    const team = await world.team(org);

    owner = await world.caller(o.user, org);
    arjun = await world.caller(a.user, org);
    teamId = team.id;

    await db.insert(teamMembers).values({
      organizationId: org.id,
      teamId: team.id,
      memberId: a.member.id,
    });

    const hidden = await world.project(org, {
      taskKeyPrefix: "HP",
      visibility: "private",
    });
    const open = await world.project(org, { taskKeyPrefix: "OP" });

    hiddenId = hidden.id;

    await world.task(org, hidden, {
      taskNumber: 1,
      name: "Secret reorg",
      assignedToMemberId: a.member.id,
    });
    await world.task(org, open, {
      taskNumber: 1,
      name: "Visible work",
      assignedToMemberId: a.member.id,
    });

    const soon = new Date(Date.now() + 3_600_000);

    trashedTaskId = (
      await world.task(org, open, {
        taskNumber: 2,
        name: "Trashed but due",
        dueAt: soon,
        deletedAt: new Date(),
      })
    ).id;
    openTaskId = (
      await world.task(org, open, {
        taskNumber: 3,
        name: "Open and due",
        dueAt: soon,
      })
    ).id;

    await owner.automation.create({
      name: "Private rule",
      triggerEvent: "task.created",
      triggerConfig: {},
      actionType: "set_priority",
      actionConfig: { priority: "high" },
      projectId: hidden.id,
    });
  });

  it("the team workload leaves out tasks from projects the viewer cannot see", async () => {
    const workload = await arjun.team.getTeamWorkload({ id: teamId });
    const names = workload.tasks.map((task) => task.name);

    expect(names).toContain("Visible work");
    expect(names).not.toContain("Secret reorg");
    expect(workload.totalTasks).toBe(1);
  });

  it("the automation list leaves out rules of projects the viewer cannot see", async () => {
    const names = (await arjun.automation.getAll()).map((rule) => rule.name);

    expect(names).not.toContain("Private rule");
    expect(
      (await owner.automation.getAll()).map((rule) => rule.name),
    ).toContain("Private rule");
    expect(hiddenId).toBeTruthy();
  });

  it("SLA escalation skips trashed tasks", async () => {
    await owner.automation.create({
      name: "Escalate soon",
      triggerEvent: "task.due_date_approaching",
      triggerConfig: { withinHours: 24 },
      actionType: "set_priority",
      actionConfig: { priority: "high" },
    });

    const result = await owner.automation.escalateDueSLA();

    expect(result.tasks.map((task) => task.name)).toEqual(["Open and due"]);

    const [trashed] = await db
      .select({ priority: tasks.priority })
      .from(tasks)
      .where(eq(tasks.id, trashedTaskId));
    const [open] = await db
      .select({ priority: tasks.priority })
      .from(tasks)
      .where(eq(tasks.id, openTaskId));

    expect(trashed!.priority).not.toBe("high");
    expect(open!.priority).toBe("high");
  });
});
