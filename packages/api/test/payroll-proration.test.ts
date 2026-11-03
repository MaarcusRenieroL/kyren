import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { compensations, employees } from "@zentro/db/schema";

import { proratedBase } from "../src/server/payroll-math";
import { World } from "./helpers";

describe("proratedBase", () => {
  const annual = 1_200_000;

  it("pays exactly a twelfth for a whole calendar month", () => {
    expect(proratedBase(annual, "2026-01-01", "2026-01-31")).toBe(100_000);
    expect(proratedBase(annual, "2026-02-01", "2026-02-28")).toBe(100_000);
  });

  it("pays n twelfths for n whole months", () => {
    expect(proratedBase(annual, "2026-01-01", "2026-03-31")).toBe(300_000);
  });

  it("pays by the day inside a partial month", () => {
    // 7 of 31 days of January.
    expect(proratedBase(annual, "2026-01-01", "2026-01-07")).toBe(
      Math.round((100_000 * 7) / 31),
    );
  });

  it("pays only from the start date and up to the end date", () => {
    expect(
      proratedBase(annual, "2026-01-01", "2026-01-31", "2026-01-16", null),
    ).toBe(Math.round((100_000 * 16) / 31));
    expect(
      proratedBase(annual, "2026-01-01", "2026-01-31", null, "2026-01-10"),
    ).toBe(Math.round((100_000 * 10) / 31));
  });

  it("pays nothing outside the employment window", () => {
    expect(
      proratedBase(annual, "2026-01-01", "2026-01-31", null, "2025-12-31"),
    ).toBe(0);
    expect(
      proratedBase(annual, "2026-01-01", "2026-01-31", "2026-02-01", null),
    ).toBe(0);
  });
});

const world = new World();

afterAll(() => world.cleanup());

describe("pay runs", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;

  beforeAll(async () => {
    const org = await world.org("Proration org");
    const o = await world.userIn(org, "owner", "Pay Owner");

    owner = await world.caller(o.user, org);

    const joiner = await db
      .insert(employees)
      .values({
        organizationId: org.id,
        name: "Mid Month Joiner",
        jobTitle: "",
        startDate: "2026-01-16",
      })
      .returning();
    const leaver = await db
      .insert(employees)
      .values({
        organizationId: org.id,
        name: "Past Leaver",
        jobTitle: "",
        endDate: "2025-06-30",
        status: "leaving",
      })
      .returning();

    for (const row of [joiner[0]!, leaver[0]!]) {
      await db.insert(compensations).values({
        organizationId: org.id,
        employeeId: row.id,
        annualSalary: 1_200_000,
        currency: "USD",
      });
    }
  });

  it("prorates a joiner and skips someone who left before the period", async () => {
    const { id } = await owner.payroll.createRun({
      label: "January",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      deductionRateBps: 0,
    });
    const run = await owner.payroll.run({ id });
    const names = run.lines.map((line) => line.employeeName);

    expect(names).toEqual(["Mid Month Joiner"]);
    expect(run.lines[0]!.base).toBe(Math.round((100_000 * 16) / 31));
  });

  it("refuses a run that overlaps an existing one", async () => {
    await expect(
      owner.payroll.createRun({
        label: "Overlap",
        periodStart: "2026-01-20",
        periodEnd: "2026-02-19",
        deductionRateBps: 0,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      owner.payroll.createRun({
        label: "February",
        periodStart: "2026-02-01",
        periodEnd: "2026-02-28",
        deductionRateBps: 0,
      }),
    ).resolves.toHaveProperty("id");
  });
});
