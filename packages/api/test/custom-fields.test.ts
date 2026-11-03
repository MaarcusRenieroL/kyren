import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("tasks can carry fields an organization defines", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let member: Awaited<ReturnType<World["caller"]>>;
  let outsider: Awaited<ReturnType<World["caller"]>>;
  let key: string;
  let otherKey: string;

  beforeAll(async () => {
    const org = await world.org("Fields");
    const o = await world.userIn(org, "owner", "Field Owner");
    const m = await world.userIn(org, "member", "Field Member");
    const project = await world.project(org);
    const task = await world.task(org, project, {
      assignedToMemberId: m.member.id,
    });

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    key = task.key;

    const other = await world.org("Other fields");
    const x = await world.userIn(other, "owner", "Other Owner");
    const otherProject = await world.project(other);

    otherKey = (await world.task(other, otherProject, { taskNumber: 99 })).key;
    outsider = await world.caller(x.user, other);
  });

  it("lets only an admin define fields, with a unique name per organization", async () => {
    await expect(
      member.customField.create({ name: "Client", type: "text" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await owner.customField.create({ name: "Client", type: "text" });
    await expect(
      owner.customField.create({ name: " client ", type: "text" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      owner.customField.create({ name: "Tier", type: "select", options: [] }),
    ).rejects.toThrow();
  });

  it("checks each value against its field's type", async () => {
    const budget = await owner.customField.create({
      name: "Budget",
      type: "number",
    });
    const due = await owner.customField.create({
      name: "Review",
      type: "date",
    });
    const tier = await owner.customField.create({
      name: "Tier",
      type: "select",
      options: ["Gold", "Silver"],
    });

    await member.customField.setValue({
      key,
      fieldId: budget.id,
      value: "12.5",
    });
    await member.customField.setValue({
      key,
      fieldId: due.id,
      value: "2026-12-01",
    });
    await member.customField.setValue({ key, fieldId: tier.id, value: "Gold" });

    for (const [fieldId, value] of [
      [budget.id, "lots"],
      [due.id, "tomorrow"],
      [tier.id, "Bronze"],
    ] as const) {
      await expect(
        member.customField.setValue({ key, fieldId, value }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }

    const values = await member.customField.valuesForTask({ key });

    expect(
      values
        .filter((v) => v.value !== null)
        .map((v) => [v.name, v.value])
        .sort(),
    ).toEqual([
      ["Budget", "12.5"],
      ["Review", "2026-12-01"],
      ["Tier", "Gold"],
    ]);

    await member.customField.setValue({ key, fieldId: tier.id, value: null });
    expect(
      (await member.customField.valuesForTask({ key })).find(
        (v) => v.name === "Tier",
      )?.value,
    ).toBeNull();
  });

  it("never crosses organizations", async () => {
    const [field] = await owner.customField.list();

    expect(await outsider.customField.list()).toEqual([]);
    await expect(
      outsider.customField.setValue({
        key: otherKey,
        fieldId: field!.id,
        value: "x",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      owner.customField.setValue({
        key: otherKey,
        fieldId: field!.id,
        value: "x",
      }),
    ).rejects.toThrow();
  });

  it("removes a field and its values together", async () => {
    const fields = await owner.customField.list();
    const budget = fields.find((f) => f.name === "Budget")!;

    await owner.customField.remove({ id: budget.id });

    expect(
      (await owner.customField.list()).some((f) => f.name === "Budget"),
    ).toBe(false);
    expect(
      (await member.customField.valuesForTask({ key })).some(
        (v) => v.name === "Budget",
      ),
    ).toBe(false);
  });
});
