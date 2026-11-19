import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const rule = {
  name: "Bump priority",
  triggerEvent: "task.created" as const,
  triggerConfig: {},
  actionType: "set_priority" as const,
  actionConfig: { priority: "high" },
};

describe("task features respect private projects and roles", () => {
  let owner: Caller;
  let member: Caller;
  let reporter: Caller;
  let readOnly: Caller;
  let hiddenId: string;
  let hiddenRuleId: string;
  let orgRuleId: string;

  beforeAll(async () => {
    const org = await world.org("Task leaks");
    const o = await world.userIn(org, "owner", "Priya");
    const m = await world.userIn(org, "member", "Arjun");
    const r = await world.userIn(org, "member", "Reporter");
    const v = await world.userIn(org, "member", "Viewer");

    await world.override(org, r.user, "time.view_report", "allow");
    await world.override(org, v.user, "tasks.update_own", "deny");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    reporter = await world.caller(r.user, org);
    readOnly = await world.caller(v.user, org);

    const open = await world.project(org, { taskKeyPrefix: "OPN" });
    const hidden = await world.project(org, {
      taskKeyPrefix: "HID",
      visibility: "private",
    });

    hiddenId = hidden.id;
    await world.task(org, open, { taskNumber: 1, name: "Open work" });
    await world.task(org, hidden, { taskNumber: 1, name: "Secret work" });

    await owner.task.logTime({ key: "HID-1", durationMinutes: 30 });
    await owner.task.logTime({ key: "OPN-1", durationMinutes: 15 });

    hiddenRuleId = (await owner.automation.create({
      ...rule,
      projectId: hiddenId,
    }))!.id;
    orgRuleId = (await owner.automation.create({ ...rule, name: "Org rule" }))!
      .id;
  });

  it("custom field values of a hidden task are not found", async () => {
    await expect(
      member.customField.valuesForTask({ key: "HID-1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      owner.customField.valuesForTask({ key: "HID-1" }),
    ).resolves.toBeDefined();
  });

  it("a timer needs the right to log time on that task", async () => {
    await expect(
      member.timesheet.start({ key: "HID-1" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      readOnly.timesheet.start({ key: "OPN-1" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(member.timesheet.start({ key: "OPN-1" })).resolves.toEqual({
      ok: true,
    });
    await member.timesheet.stop();
  });

  it("the time report names only tasks the viewer can see", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const now = await reporter.timesheet.report({ from: today, to: today });

    expect(now.tasks.map((t) => t.name)).toContain("Open work");
    expect(now.tasks.map((t) => t.name)).not.toContain("Secret work");
  });

  it("a member cannot make a rule that runs on every task", async () => {
    await expect(
      member.automation.create({ ...rule, name: "Everywhere" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a member cannot switch off or delete rules they should not reach", async () => {
    await expect(
      member.automation.toggle({ id: hiddenRuleId, enabled: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      member.automation.delete({ id: hiddenRuleId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      member.automation.toggle({ id: orgRuleId, enabled: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.automation.toggle({ id: orgRuleId, enabled: false }),
    ).resolves.toMatchObject({ enabled: false });
  });
});
