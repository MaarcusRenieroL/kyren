import { and, eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { dateStr, encryptField, when, type SeedContext } from "./context";

export async function seedHr(ctx: SeedContext) {
  const { orgId, members, memberMap } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

  // 5. HR: Employees & Leave Requests
  console.log("🌱 Seeding HR employees and leave requests...");
  const employeeRoster = [
    {
      key: "priya",
      title: "VP of Operations",
      dept: "Operations",
      loc: "New York, USA",
      start: "2024-01-15",
      managerKey: null,
    },
    {
      key: "daniel",
      title: "Head of Engineering",
      dept: "Engineering",
      loc: "San Francisco, USA",
      start: "2024-02-01",
      managerKey: "priya",
    },
    {
      key: "meilin",
      title: "Lead Product Designer",
      dept: "Design",
      loc: "San Francisco, USA",
      start: "2024-03-01",
      managerKey: "priya",
    },
    {
      key: "tomas",
      title: "Senior Frontend Engineer",
      dept: "Engineering",
      loc: "London, UK",
      start: "2024-04-10",
      managerKey: "daniel",
    },
    {
      key: "sofia",
      title: "Senior Backend & Infra Engineer",
      dept: "Engineering",
      loc: "Berlin, Germany",
      start: "2024-04-15",
      managerKey: "daniel",
    },
    {
      key: "jamal",
      title: "Lead Product Manager",
      dept: "Product",
      loc: "New York, USA",
      start: "2024-05-01",
      managerKey: "priya",
    },
    {
      key: "ravi",
      title: "Fullstack Engineer & Support Lead",
      dept: "Engineering",
      loc: "Austin, USA",
      start: "2024-06-01",
      managerKey: "daniel",
    },
    {
      key: "hannah",
      title: "People & Talent Operations Lead",
      dept: "Operations",
      loc: "Chicago, USA",
      start: "2024-06-15",
      managerKey: "priya",
    },
  ];

  const empIdMap = new Map<string, string>();
  for (const emp of employeeRoster) {
    const m = memberMap.get(emp.key)!;
    const [existing] = await db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .where(
        and(
          eq(schema.employees.organizationId, orgId),
          eq(schema.employees.memberId, m.memberId),
        ),
      );

    if (existing) {
      empIdMap.set(emp.key, existing.id);
      await db
        .update(schema.employees)
        .set({
          name: m.name,
          email: m.email,
          jobTitle: emp.title,
          department: emp.dept,
          location: emp.loc,
          startDate: emp.start,
          status: "active",
        })
        .where(eq(schema.employees.id, existing.id));
    } else {
      const [inserted] = await db
        .insert(schema.employees)
        .values({
          organizationId: orgId,
          memberId: m.memberId,
          name: m.name,
          email: m.email,
          jobTitle: emp.title,
          department: emp.dept,
          location: emp.loc,
          startDate: emp.start,
          status: "active",
        })
        .returning({ id: schema.employees.id });
      empIdMap.set(emp.key, inserted!.id);
    }
  }

  // Set managers
  for (const emp of employeeRoster) {
    if (emp.managerKey && empIdMap.has(emp.managerKey)) {
      await db
        .update(schema.employees)
        .set({ managerId: empIdMap.get(emp.managerKey) })
        .where(eq(schema.employees.id, empIdMap.get(emp.key)!));
    }
  }

  // Clean and re-seed leave requests
  await db
    .delete(schema.leaveRequests)
    .where(eq(schema.leaveRequests.organizationId, orgId));
  const leaveDefs = [
    {
      emp: "tomas",
      type: "annual",
      start: dateStr(-14),
      end: dateStr(-10),
      days: 5,
      note: "Family vacation to Spain.",
      status: "approved",
      decBy: daniel.memberId,
      decAt: when(-18),
    },
    {
      emp: "sofia",
      type: "sick",
      start: dateStr(-4),
      end: dateStr(-3),
      days: 2,
      note: "Seasonal flu recovery.",
      status: "approved",
      decBy: daniel.memberId,
      decAt: when(-4),
    },
    {
      emp: "jamal",
      type: "annual",
      start: dateStr(15),
      end: dateStr(19),
      days: 5,
      note: "Thanksgiving holiday week off.",
      status: "pending",
      decBy: null,
      decAt: null,
    },
    {
      emp: "meilin",
      type: "annual",
      start: dateStr(-30),
      end: dateStr(-26),
      days: 5,
      note: "Design retreat and annual time off.",
      status: "approved",
      decBy: priya.memberId,
      decAt: when(-35),
    },
    {
      emp: "ravi",
      type: "annual",
      start: dateStr(22),
      end: dateStr(24),
      days: 3,
      note: "Attending tech conference and personal days.",
      status: "pending",
      decBy: null,
      decAt: null,
    },
  ];

  for (const req of leaveDefs) {
    await db.insert(schema.leaveRequests).values({
      organizationId: orgId,
      employeeId: empIdMap.get(req.emp)!,
      type: req.type,
      startDate: req.start,
      endDate: req.end,
      days: req.days,
      note: encryptField(req.note),
      status: req.status,
      decidedByMemberId: req.decBy,
      decidedAt: req.decAt,
    });
  }
  console.log("✅ Seeded HR employees and leave requests");


  return empIdMap;
}
