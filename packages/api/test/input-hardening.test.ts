import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("input hardening", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let member: Awaited<ReturnType<World["caller"]>>;

  beforeAll(async () => {
    const org = await world.org("Hardening");
    const { user: ownerUser } = await world.userIn(org, "owner", "H owner");
    const { user: memberUser } = await world.userIn(org, "member", "H member");

    owner = await world.caller(ownerUser, org);
    member = await world.caller(memberUser, org);

    await owner.hr.create({
      name: "Member Person",
      email: null,
      jobTitle: "",
      department: null,
      location: null,
      status: "active",
      startDate: null,
      endDate: null,
      managerId: null,
      memberId:
        (await owner.hr.unlinkedMembers()).find(
          (entry) => entry.name === "H member",
        )?.id ?? null,
    });
  });

  it("rejects dates that do not exist", async () => {
    await expect(
      member.hr.leaveRequest({
        type: "annual",
        startDate: "2026-02-31",
        endDate: "2026-03-02",
        note: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.payroll.createRun({
        label: "Bad",
        periodStart: "2026-13-01",
        periodEnd: "2026-13-30",
        deductionRateBps: 2000,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects leave that spans more than a year", async () => {
    await expect(
      member.hr.leaveRequest({
        type: "annual",
        startDate: "2026-01-01",
        endDate: "9999-12-31",
        note: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("caps whiteboard size and restricts colours", async () => {
    const { id } = await owner.whiteboard.create({ title: "Big" });
    const stroke = (index: number, points: number[]) => ({
      id: `s${index}`,
      type: "pen" as const,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      points,
      color: "#112233",
    });

    await expect(
      owner.whiteboard.save({
        id,
        elements: Array.from({ length: 40 }, (_, index) =>
          stroke(
            index,
            Array.from({ length: 6000 }, () => 1),
          ),
        ),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.whiteboard.save({
        id,
        elements: [{ ...stroke(1, [1, 2]), color: "red;} body{display:none" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Fills are held to the same palette rule.
    await expect(
      owner.whiteboard.save({
        id,
        elements: [{ ...stroke(1, [1, 2]), fill: "url(javascript:x)" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await owner.whiteboard.save({ id, elements: [stroke(1, [1, 2, 3, 4])] });
    // The theme-aware "ink" swatch from the board palette stays valid.
    await expect(
      owner.whiteboard.save({
        id,
        elements: [{ ...stroke(2, [1, 2]), color: "ink", fill: "none" }],
      }),
    ).resolves.toBeTruthy();
  });
});
