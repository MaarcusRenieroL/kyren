import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("importing employees in bulk", () => {
  let hr: Caller;
  let plain: Caller;

  beforeAll(async () => {
    const org = await world.org("HR import");
    const o = await world.userIn(org, "owner", "Priya");
    const m = await world.userIn(org, "member", "Plain Member");

    hr = await world.caller(o.user, org);
    plain = await world.caller(m.user, org);
  });

  it("adds every row and skips emails already on file", async () => {
    await hr.hr.create({
      name: "Existing",
      email: "dup@example.test",
      jobTitle: "Engineer",
      department: null,
      location: null,
      status: "active",
      startDate: null,
      endDate: null,
      managerId: null,
      memberId: null,
    });

    const result = await hr.hr.importEmployees({
      rows: [
        { name: "Ana", email: "ana@example.test", jobTitle: "Designer" },
        { name: "Dup again", email: "DUP@example.test" },
        { name: "No email" },
        { name: "Twice", email: "ana@example.test" },
      ],
    });

    expect(result).toEqual({ created: 2, skipped: 2 });

    const names = (await hr.hr.directory()).people.map((e) => e.name);

    expect(names).toEqual(expect.arrayContaining(["Ana", "No email"]));
    expect(names).not.toContain("Dup again");
    expect(names).not.toContain("Twice");
  });

  it("refuses an invalid row without adding any", async () => {
    const before = (await hr.hr.directory()).people.length;

    await expect(
      hr.hr.importEmployees({
        rows: [{ name: "Fine" }, { name: "Bad", email: "not-an-email" }],
      }),
    ).rejects.toThrow();
    expect((await hr.hr.directory()).people.length).toBe(before);
  });

  it("needs hr.manage", async () => {
    await expect(
      plain.hr.importEmployees({ rows: [{ name: "Nope" }] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
