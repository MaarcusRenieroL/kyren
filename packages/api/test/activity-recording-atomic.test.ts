import { afterAll, describe, expect, it } from "vitest";

import { createAuditContext } from "../src/server/audit";
import { fetchEvents as events } from "./helpers/activity-recording-helpers";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("atomic recording", () => {
  async function setup() {
    const org = await world.org("Atomic");
    const o = await world.userIn(org, "owner", "Atom Owner");
    const project = await world.project(org, { taskKeyPrefix: "AT" });

    return { org, user: o.user, project };
  }

  it("rolls the change back when the event cannot be written", async () => {
    const { org, user, project } = await setup();
    const caller = await world.caller(user, org, {
      wrapAudit: (audit) => ({
        ...audit,
        forCall: () => ({
          ...audit,
          async record() {
            throw new Error("event store down");
          },
        }),
      }),
    });

    await expect(
      caller.task.createTask({ projectId: project.id, name: "Never saved" }),
    ).rejects.toThrow();

    const task = await caller.task.getTasksByOrgId({});

    expect(task.map((item) => item.name)).not.toContain("Never saved");
    expect(await events(org)).toHaveLength(0);
  });

  it("leaves no event behind when the change fails after it", async () => {
    const { org, user, project } = await setup();
    const real = createAuditContext({
      organizationId: org.id,
      userId: user.id,
    });
    const caller = await world.caller(user, org, {
      wrapAudit: () => ({
        ...real,
        forCall: () => ({
          ...real,
          async record(handle, input) {
            await real.record(handle, input);
            throw new Error("fails after the event was written");
          },
        }),
      }),
    });

    await expect(
      caller.task.createTask({ projectId: project.id, name: "Rolled back" }),
    ).rejects.toThrow();
    expect(
      (await caller.task.getTasksByOrgId({})).map((item) => item.name),
    ).not.toContain("Rolled back");
    expect(await events(org)).toHaveLength(0);
  });

  it("fails a declared mutation that records nothing outside production", async () => {
    const { org, user, project } = await setup();
    const real = createAuditContext({
      organizationId: org.id,
      userId: user.id,
    });
    const caller = await world.caller(user, org, {
      wrapAudit: () => ({
        ...real,
        forCall: () => ({
          ...real,
          async record() {
            return {} as never;
          },
        }),
      }),
    });

    await expect(
      caller.task.createTask({ projectId: project.id, name: "Silent" }),
    ).rejects.toThrow(/without recording/);
  });
});
