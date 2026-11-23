import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { dateStr, encryptField, when, type SeedContext } from "./context";

export async function seedPayroll(ctx: SeedContext, empIdMap: Map<string, string>) {
  const { orgId, members, memberMap } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

  // 6. Payroll: Compensations, Pay Runs, Payslips
  console.log("🌱 Seeding Payroll compensations, pay runs, and payslips...");
  const salaries: Record<string, number> = {
    priya: 185_000_00, // $185k in cents
    daniel: 175_000_00, // $175k in cents
    meilin: 155_000_00, // $155k in cents
    tomas: 145_000_00, // $145k in cents
    sofia: 150_000_00, // $150k in cents
    jamal: 140_000_00, // $140k in cents
    ravi: 130_000_00, // $130k in cents
    hannah: 105_000_00, // $105k in cents
  };

  for (const [key, annualSalary] of Object.entries(salaries)) {
    const empId = empIdMap.get(key)!;
    await db
      .insert(schema.compensations)
      .values({
        organizationId: orgId,
        employeeId: empId,
        annualSalary,
        currency: "USD",
      })
      .onConflictDoUpdate({
        target: [schema.compensations.employeeId],
        set: { annualSalary, updatedAt: new Date() },
      });
  }

  // Pay runs: September (paid), October (paid), November (draft)
  await db
    .delete(schema.payslips)
    .where(eq(schema.payslips.organizationId, orgId));
  await db
    .delete(schema.payRuns)
    .where(eq(schema.payRuns.organizationId, orgId));

  const runDefs = [
    {
      label: "September 2026 Monthly Payroll",
      start: "2026-09-01",
      end: "2026-09-30",
      status: "paid",
      approvedAt: new Date("2026-09-28T14:00:00Z"),
      paidAt: new Date("2026-09-30T10:00:00Z"),
    },
    {
      label: "October 2026 Monthly Payroll",
      start: "2026-10-01",
      end: "2026-10-31",
      status: "paid",
      approvedAt: new Date("2026-10-29T15:00:00Z"),
      paidAt: new Date("2026-10-31T11:00:00Z"),
    },
    {
      label: "November 2026 Monthly Payroll",
      start: "2026-11-01",
      end: "2026-11-30",
      status: "draft",
      approvedAt: null,
      paidAt: null,
    },
  ];

  for (const runDef of runDefs) {
    const [run] = await db
      .insert(schema.payRuns)
      .values({
        organizationId: orgId,
        createdByMemberId: priya.memberId,
        label: runDef.label,
        periodStart: runDef.start,
        periodEnd: runDef.end,
        deductionRateBps: 2000, // 20%
        currency: "USD",
        status: runDef.status,
        approvedAt: runDef.approvedAt,
        paidAt: runDef.paidAt,
      })
      .returning({ id: schema.payRuns.id });

    // Generate payslip for each employee
    for (const [key, annualSalary] of Object.entries(salaries)) {
      const empId = empIdMap.get(key)!;
      const m = memberMap.get(key)!;
      const baseMonthly = Math.round(annualSalary / 12);
      const bonus =
        runDef.label.includes("October") && key === "daniel" ? 50_000_00 : 0; // $500 bonus in Oct
      const gross = baseMonthly + bonus;
      const deductions = Math.round((gross * 2000) / 10000);
      const net = gross - deductions;

      await db.insert(schema.payslips).values({
        payRunId: run!.id,
        organizationId: orgId,
        employeeId: empId,
        employeeName: m.name,
        currency: "USD",
        base: baseMonthly,
        bonus,
        deductions,
        net,
      });
    }
  }
  console.log("✅ Seeded Payroll compensations, 3 pay runs, and 24 payslips");


}
