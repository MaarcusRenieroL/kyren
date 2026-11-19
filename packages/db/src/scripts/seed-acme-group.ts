import {
  createCipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../client/index";
import * as schema from "../schema";
import { and, eq, sql } from "drizzle-orm";

const PREFIX = "enc:v1:";
function encryptField(value: string | null) {
  if (value === null) return null;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) return value;
  const secret = Buffer.from(raw, "base64");
  if (secret.length !== 32) return value;
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, nonce);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${Buffer.concat([nonce, cipher.getAuthTag(), body]).toString("base64")}`;
}

const dayMs = 86_400_000;
const now = Date.now();
const when = (days: number) => new Date(now + days * dayMs);
const dateStr = (days: number) => when(days).toISOString().slice(0, 10);

async function main() {
  console.log("🚀 Starting Acme Group comprehensive mock data seeding...");

  // 1. Locate and update Acme organization
  const orgId = "5cba4782-7a7d-4b3b-8ffe-0222125241fc";
  const [existingOrg] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId));

  if (!existingOrg) {
    throw new Error(`Organization ${orgId} not found in database!`);
  }

  await db
    .update(schema.organizations)
    .set({
      name: "Acme Group",
      slug: "acme-group",
      updatedAt: new Date(),
    })
    .where(eq(schema.organizations.id, orgId));
  console.log("✅ Updated organization to 'Acme Group' (slug: acme-group)");

  // 2. Ensure all 14 modules are enabled
  const allModules = [
    "dashboard",
    "settings",
    "projects",
    "tasks",
    "docs",
    "chat",
    "files",
    "calendar",
    "whiteboards",
    "mail",
    "tickets",
    "hr",
    "payroll",
    "admin",
  ];

  for (const mod of allModules) {
    await db
      .insert(schema.organizationModules)
      .values({
        organizationId: orgId,
        moduleId: mod,
        enabled: true,
        config: {},
      })
      .onConflictDoUpdate({
        target: [
          schema.organizationModules.organizationId,
          schema.organizationModules.moduleId,
        ],
        set: { enabled: true, updatedAt: new Date() },
      });
  }
  console.log("✅ Enabled all 14 modules in organizationModules");

  // 3. Load Members & Users
  const membersList = await db
    .select({
      member: schema.members,
      user: schema.users,
    })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(eq(schema.members.organizationId, orgId));

  const memberMap = new Map<
    string,
    { memberId: string; userId: string; name: string; email: string }
  >();
  for (const row of membersList) {
    const key =
      (row.user.email ? row.user.email.split("@")[0] : null) ||
      row.user.name.toLowerCase().split(" ")[0] ||
      "user";
    memberMap.set(key, {
      memberId: row.member.id,
      userId: row.user.id,
      name: row.user.name,
      email: row.user.email,
    });
  }

  const priya = memberMap.get("priya")!;
  const daniel = memberMap.get("daniel")!;
  const meilin = memberMap.get("meilin")!;
  const tomas = memberMap.get("tomas")!;
  const sofia = memberMap.get("sofia")!;
  const jamal = memberMap.get("jamal")!;
  const ravi = memberMap.get("ravi")!;
  const hannah = memberMap.get("hannah")!;

  console.log(
    `✅ Loaded ${memberMap.size} Acme members: Priya, Daniel, Mei Lin, Tomás, Sofia, Jamal, Ravi, Hannah`,
  );

  // 4. Teams: Ensure Design, Engineering, Operations, Product & Growth exist
  const existingTeams = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.organizationId, orgId));

  const teamMap = new Map<string, string>();
  for (const t of existingTeams) {
    teamMap.set(t.name, t.id);
  }

  if (!teamMap.has("Product & Growth")) {
    const [t] = await db
      .insert(schema.teams)
      .values({
        organizationId: orgId,
        name: "Product & Growth",
        color: "amber",
        description:
          "Product discovery, analytics, user research, and PLG experiments",
      })
      .returning({ id: schema.teams.id });
    teamMap.set("Product & Growth", t!.id);

    // Add Jamal and Priya to Product team
    if (jamal) {
      await db
        .insert(schema.teamMembers)
        .values({
          organizationId: orgId,
          teamId: t!.id,
          memberId: jamal.memberId,
        })
        .onConflictDoNothing();
    }
  }

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

  // 7. Sprints & Projects
  console.log("🌱 Seeding Sprints...");
  const projectsList = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.organizationId, orgId));

  const websiteProject =
    projectsList.find((p) => p.slug === "website-redesign") || projectsList[0]!;
  const mobileProject =
    projectsList.find((p) => p.slug === "mobile-app") || projectsList[1]!;

  // Clean existing sprints
  await db
    .delete(schema.sprints)
    .where(eq(schema.sprints.organizationId, orgId));

  const [sprintPast] = await db
    .insert(schema.sprints)
    .values({
      organizationId: orgId,
      projectId: websiteProject.id,
      name: "Sprint 31 - Design System & Layout Engine",
      goal: "Ship unified component tokens and responsive hero sections across marketing surfaces.",
      startsOn: dateStr(-28),
      endsOn: dateStr(-14),
      status: "completed",
      committedPoints: 38,
      completedPoints: 36,
      completedAt: when(-14),
    })
    .returning();

  const [sprintActive] = await db
    .insert(schema.sprints)
    .values({
      organizationId: orgId,
      projectId: websiteProject.id,
      name: "Sprint 32 - Interactive Forms & Portal Integrations",
      goal: "Finalize customer onboarding flow, dynamic pricing calculator, and high-conversion lead forms.",
      startsOn: dateStr(-13),
      endsOn: dateStr(1),
      status: "active",
      committedPoints: 45,
      completedPoints: 28,
    })
    .returning();

  const [sprintPlanned] = await db
    .insert(schema.sprints)
    .values({
      organizationId: orgId,
      projectId: websiteProject.id,
      name: "Sprint 33 - Performance, SEO & GA Release",
      goal: "Lighthouse 95+ score, OpenGraph assets, and production deployment.",
      startsOn: dateStr(2),
      endsOn: dateStr(16),
      status: "planned",
      committedPoints: 32,
    })
    .returning();

  const [sprintMobileActive] = await db
    .insert(schema.sprints)
    .values({
      organizationId: orgId,
      projectId: mobileProject.id,
      name: "Mobile Sprint 14 - Biometric Auth & Offline Queue",
      goal: "Zero-latency offline ticket caching and local biometric unlock flow.",
      startsOn: dateStr(-7),
      endsOn: dateStr(7),
      status: "active",
      committedPoints: 30,
      completedPoints: 18,
    })
    .returning();

  console.log("✅ Seeded 4 Sprints across Web and Mobile projects");

  // 8. Custom Fields & Task Enhancements
  console.log("🌱 Seeding Custom Fields, Views & Templates...");
  await db
    .delete(schema.customFields)
    .where(eq(schema.customFields.organizationId, orgId));

  const [cfPoints] = await db
    .insert(schema.customFields)
    .values({
      organizationId: orgId,
      name: "Story Points",
      type: "number",
      options: [],
      position: 0,
    })
    .returning();

  const [cfTier] = await db
    .insert(schema.customFields)
    .values({
      organizationId: orgId,
      name: "Customer Impact",
      type: "select",
      options: [
        "P0 - Blocker",
        "P1 - Critical",
        "P2 - Important",
        "P3 - Normal",
      ],
      position: 1,
    })
    .returning();

  const [cfTrack] = await db
    .insert(schema.customFields)
    .values({
      organizationId: orgId,
      name: "Release Target",
      type: "select",
      options: ["v2.4.0", "v2.5.0", "v3.0.0-Beta"],
      position: 2,
    })
    .returning();

  // Task templates
  await db
    .delete(schema.taskTemplates)
    .where(eq(schema.taskTemplates.organizationId, orgId));
  await db.insert(schema.taskTemplates).values([
    {
      organizationId: orgId,
      name: "Bug Escalation & Hotfix",
      taskDescription:
        "Standard workflow for investigating, testing, and shipping customer-reported bugs.",
      priority: "high",
      estimatePoints: 3,
      dueInDays: 2,
      subtasks: [
        "Reproduce locally and verify logs",
        "Write failing unit/integration test",
        "Implement fix and verify green suite",
        "Deploy to staging and verify",
        "Ship to production and monitor",
      ],
      createdByMemberId: daniel.memberId,
    },
    {
      organizationId: orgId,
      name: "Feature Implementation Cycle",
      taskDescription:
        "End-to-end steps to take a feature from spec to shipped product.",
      priority: "medium",
      estimatePoints: 8,
      dueInDays: 14,
      subtasks: [
        "Technical architecture review",
        "Figma design specs review",
        "Core data schema & API endpoints",
        "Frontend UI implementation",
        "End-to-end tests & security check",
        "Documentation & release notes",
      ],
      createdByMemberId: jamal.memberId,
    },
    {
      organizationId: orgId,
      name: "Enterprise Customer Onboarding",
      taskDescription:
        "Provisioning and configuration checklist for new enterprise organization rollout.",
      priority: "high",
      estimatePoints: 5,
      dueInDays: 7,
      subtasks: [
        "Configure SAML SSO / Okta connection",
        "Provision organization seat tier",
        "Schedule kickoff training session",
        "Setup custom domain and brand logo",
        "Deliver 30-day success review",
      ],
      createdByMemberId: priya.memberId,
    },
  ]);

  // Task views
  await db
    .delete(schema.taskViews)
    .where(eq(schema.taskViews.organizationId, orgId));
  await db.insert(schema.taskViews).values([
    {
      organizationId: orgId,
      ownerUserId: priya.userId,
      name: "Sprint 32 Overview",
      shared: true,
      config: {
        search: "",
        status: "all",
        priority: "all",
        assignee: "all",
        team: "all",
        group: "status",
        sort: "priority",
        view: "board",
      },
    },
    {
      organizationId: orgId,
      ownerUserId: daniel.userId,
      name: "High Priority Engineering Queue",
      shared: true,
      config: {
        search: "",
        status: "in-progress",
        priority: "high",
        assignee: "all",
        team: "all",
        group: "assignee",
        sort: "dueAt",
        view: "list",
      },
    },
  ]);

  // Update existing tasks with sprint IDs, points, and custom field values
  const allTasks = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.organizationId, orgId));

  for (let i = 0; i < allTasks.length; i++) {
    const t = allTasks[i]!;
    const sprint =
      i % 3 === 0
        ? sprintActive!.id
        : i % 3 === 1
          ? sprintPast!.id
          : sprintPlanned!.id;
    const points = [1, 2, 3, 5, 8][i % 5]!;
    await db
      .update(schema.tasks)
      .set({
        sprintId: sprint,
        estimatePoints: points,
      })
      .where(eq(schema.tasks.id, t.id));

    // Custom field value
    await db
      .insert(schema.customFieldValues)
      .values({
        taskId: t.id,
        fieldId: cfPoints!.id,
        value: String(points),
      })
      .onConflictDoNothing();

    await db
      .insert(schema.customFieldValues)
      .values({
        taskId: t.id,
        fieldId: cfTier!.id,
        value: [
          "P0 - Blocker",
          "P1 - Critical",
          "P2 - Important",
          "P3 - Normal",
        ][i % 4]!,
      })
      .onConflictDoNothing();
  }

  // 9. Task Time Logs & Running Timer
  console.log("🌱 Seeding Task Time Logs and Running Timer...");
  await db
    .delete(schema.taskTimeLogs)
    .where(eq(schema.taskTimeLogs.organizationId, orgId));
  await db
    .delete(schema.runningTimers)
    .where(eq(schema.runningTimers.organizationId, orgId));

  const timeNotes = [
    "Refactored database query performance and added composite indexes.",
    "Drafted initial responsive layout and tested on mobile viewport.",
    "Integrated OAuth provider callback handlers and test coverage.",
    "Reviewed pull request feedback and updated component prop types.",
    "Debugged webhook retry mechanism and confirmed payload delivery.",
    "Created end-to-end Playwright tests for ticket resolution flow.",
    "Conducted architecture spike on Redis caching tier.",
  ];

  for (let i = 0; i < 25; i++) {
    const t = allTasks[i % allTasks.length]!;
    const m = [daniel, meilin, tomas, sofia, ravi][i % 5]!;
    const duration = [30, 45, 60, 90, 120, 180][i % 6]!;
    await db.insert(schema.taskTimeLogs).values({
      organizationId: orgId,
      taskId: t.id,
      memberId: m.memberId,
      durationMinutes: duration,
      note: timeNotes[i % timeNotes.length]!,
      createdAt: when(-((i % 10) + 1)),
    });
  }

  // 1 active running timer for Daniel
  if (allTasks[0]) {
    await db.insert(schema.runningTimers).values({
      organizationId: orgId,
      userId: daniel.userId,
      taskId: allTasks[0].id,
      startedAt: new Date(Date.now() - 45 * 60 * 1000), // started 45 mins ago
    });
  }

  // 10. Goals & OKRs (Objectives & Key Results)
  console.log("🌱 Seeding Objectives & Key Results...");
  await db.delete(schema.keyResultTasks).where(sql`1 = 1`);
  await db
    .delete(schema.keyResults)
    .where(eq(schema.keyResults.organizationId, orgId));
  await db
    .delete(schema.objectives)
    .where(eq(schema.objectives.organizationId, orgId));

  const objDefs = [
    {
      title: "Scale Acme Group to 100k Monthly Active Users",
      desc: "Accelerate product-led growth through virality, friction-free onboarding, and high retention.",
      period: "Q4 2026",
      owner: jamal.memberId,
      krs: [
        {
          title: "Increase day-7 user retention",
          kind: "metric",
          start: 28,
          target: 45,
          current: 39,
          unit: "%",
        },
        {
          title: "Reduce signup to activation funnel drop-off",
          kind: "metric",
          start: 35,
          target: 12,
          current: 16,
          unit: "%",
        },
        {
          title: "Ship enterprise team invite & sharing triggers",
          kind: "tasks",
          start: 0,
          target: 6,
          current: 5,
          unit: "tasks",
        },
      ],
    },
    {
      title: "Achieve 99.99% Reliability & Complete SOC 2 Type II",
      desc: "Harden cloud infrastructure, automate disaster recovery, and ensure zero unresolved security findings.",
      period: "Q4 2026",
      owner: daniel.memberId,
      krs: [
        {
          title: "Maintain 99.99% core API uptime across regions",
          kind: "metric",
          start: 99.7,
          target: 99.99,
          current: 99.96,
          unit: "%",
        },
        {
          title: "Reduce p99 database latency under 75ms",
          kind: "metric",
          start: 150,
          target: 75,
          current: 82,
          unit: "ms",
        },
        {
          title: "Complete external SOC 2 audit readiness review",
          kind: "metric",
          start: 0,
          target: 100,
          current: 90,
          unit: "%",
        },
      ],
    },
    {
      title: "Unify Brand Design System & Launch Mobile 2.0",
      desc: "Establish a unified aesthetic and release native mobile apps for iOS and Android.",
      period: "Q4 2026",
      owner: meilin.memberId,
      krs: [
        {
          title: "Publish Design System v2 token library and documentation",
          kind: "metric",
          start: 10,
          target: 100,
          current: 85,
          unit: "%",
        },
        {
          title: "Beta rollout of mobile app to 1,000 pilot users",
          kind: "metric",
          start: 0,
          target: 1000,
          current: 750,
          unit: "users",
        },
      ],
    },
  ];

  for (const o of objDefs) {
    const [obj] = await db
      .insert(schema.objectives)
      .values({
        organizationId: orgId,
        title: o.title,
        description: o.desc,
        period: o.period,
        status: "active",
        ownerMemberId: o.owner,
      })
      .returning();

    for (const kr of o.krs) {
      await db.insert(schema.keyResults).values({
        organizationId: orgId,
        objectiveId: obj!.id,
        title: kr.title,
        kind: kr.kind,
        startValue: kr.start,
        targetValue: kr.target,
        currentValue: kr.current,
        unit: kr.unit,
        ownerMemberId: o.owner,
      });
    }
  }
  console.log("✅ Seeded Objectives and Key Results");

  // 11. Tickets, Inboxes, SLA Policies & KB Articles
  console.log("🌱 Seeding Customer Support Tickets, SLAs & KB...");
  await db
    .delete(schema.ticketInbound)
    .where(eq(schema.ticketInbound.organizationId, orgId));
  await db
    .delete(schema.ticketMessages)
    .where(eq(schema.ticketMessages.organizationId, orgId));
  await db
    .delete(schema.tickets)
    .where(eq(schema.tickets.organizationId, orgId));
  await db
    .delete(schema.ticketSlaPolicies)
    .where(eq(schema.ticketSlaPolicies.organizationId, orgId));
  await db
    .delete(schema.ticketInboxes)
    .where(eq(schema.ticketInboxes.organizationId, orgId));
  await db
    .delete(schema.kbArticles)
    .where(eq(schema.kbArticles.organizationId, orgId));

  // Support inbox
  await db.insert(schema.ticketInboxes).values({
    organizationId: orgId,
    token: "acme-support-inbox-key",
    enabled: true,
  });

  // SLA policies
  await db.insert(schema.ticketSlaPolicies).values([
    {
      organizationId: orgId,
      priority: "urgent",
      firstResponseMinutes: 15,
      resolutionMinutes: 120,
    },
    {
      organizationId: orgId,
      priority: "high",
      firstResponseMinutes: 60,
      resolutionMinutes: 480,
    },
    {
      organizationId: orgId,
      priority: "normal",
      firstResponseMinutes: 240,
      resolutionMinutes: 1440,
    },
    {
      organizationId: orgId,
      priority: "low",
      firstResponseMinutes: 480,
      resolutionMinutes: 2880,
    },
  ]);

  // KB Articles
  await db.insert(schema.kbArticles).values([
    {
      organizationId: orgId,
      title: "Getting Started with Acme Group Platform",
      slug: "getting-started",
      body: "Welcome to Acme Group! This guide outlines how to invite your team, organize projects into dedicated boards, configure Slack notifications, and link issues directly to your codebase.",
      status: "published",
      audience: "public",
      updatedByMemberId: priya.memberId,
    },
    {
      organizationId: orgId,
      title: "Configuring SAML SSO & Directory Sync (SCIM)",
      slug: "sso-configuration",
      body: "Acme Group supports Enterprise SSO via Okta, Microsoft Azure AD, Google Workspace, and PingFederate. Learn how to configure your identity provider certificate and assign team roles automatically.",
      status: "published",
      audience: "public",
      updatedByMemberId: daniel.memberId,
    },
    {
      organizationId: orgId,
      title: "API Rate Limits, Webhook Retries & Security Best Practices",
      slug: "api-and-webhooks",
      body: "All REST and tRPC API requests are authenticated via bearer tokens. We enforce a burst ceiling of 1,000 requests per minute. Webhook deliveries retry up to 5 times with exponential backoff.",
      status: "published",
      audience: "public",
      updatedByMemberId: sofia.memberId,
    },
    {
      organizationId: orgId,
      title: "Internal Incident Response & Severity Matrix (SOP)",
      slug: "internal-incident-sop",
      body: "Severity 0: Production down or major data breach. Page engineering lead immediately.\nSeverity 1: Core functionality degraded for >10% of tenants.\nSeverity 2: Non-critical bugs with available workarounds.",
      status: "published",
      audience: "internal",
      updatedByMemberId: daniel.memberId,
    },
  ]);

  // Support Tickets
  const ticketDefs = [
    {
      number: 101,
      subject: "SAML SSO handshake failing with 'Invalid Response Signature'",
      description:
        "We are trying to connect our Okta production tenant to Acme Group. The initial redirect works, but callback returns signature verification failed.",
      requesterName: "Marcus Vance",
      requesterEmail: "marcus.vance@apexlogistics.test",
      priority: "urgent",
      status: "open",
      category: "Authentication",
      assignee: daniel.memberId,
      firstRespondedAt: when(-1),
      messages: [
        {
          author: null,
          kind: "reply",
          body: "Hello, we are experiencing an SSO login outage for 450 users. Okta logs report Signature Mismatch.",
        },
        {
          author: daniel.memberId,
          kind: "note",
          body: "Checking the x509 cert upload in tenant settings. Looks like the cert had trailing whitespace.",
        },
        {
          author: daniel.memberId,
          kind: "reply",
          body: "Hi Marcus, we trimmed the formatted public certificate on your SAML config. Could you test initiating login from your Okta dashboard now?",
        },
      ],
    },
    {
      number: 102,
      subject: "Need VAT ID updated on October 2026 invoice #INV-8821",
      description:
        "Please update our invoice header to include EU VAT ID: DE398182910 for tax compliance.",
      requesterName: "Helena Weiss",
      requesterEmail: "finance@strata-design.test",
      priority: "normal",
      status: "pending",
      category: "Billing",
      assignee: priya.memberId,
      firstRespondedAt: when(-2),
      messages: [
        {
          author: null,
          kind: "reply",
          body: "Our accounting department requires the VAT ID on all invoices.",
        },
        {
          author: priya.memberId,
          kind: "reply",
          body: "Hi Helena, I have reissued invoice #INV-8821 with your VAT ID included. A copy has been emailed to your billing contact.",
        },
      ],
    },
    {
      number: 103,
      subject:
        "Webhook timeouts on task.completed events during high volume sync",
      description:
        "When our batch import script completes 200 tasks in 10 seconds, our listener endpoint experiences 504 timeouts.",
      requesterName: "Liam Sterling",
      requesterEmail: "dev@cloudscale.test",
      priority: "high",
      status: "open",
      category: "API & Webhooks",
      assignee: ravi.memberId,
      firstRespondedAt: when(-1),
      messages: [
        {
          author: null,
          kind: "reply",
          body: "We are seeing dropped events on our endpoint during morning syncs.",
        },
        {
          author: ravi.memberId,
          kind: "reply",
          body: "Hi Liam, I'm investigating our worker queue concurrency. We are adding automatic batching for events fired within the same second.",
        },
      ],
    },
    {
      number: 104,
      subject: "Question about SOC 2 Type II audit report availability",
      description:
        "We are completing our annual vendor security assessment and need your latest SOC 2 report under mutual NDA.",
      requesterName: "Sarah Connor",
      requesterEmail: "compliance@cyberdyne.test",
      priority: "normal",
      status: "resolved",
      category: "Security",
      assignee: priya.memberId,
      firstRespondedAt: when(-5),
      resolvedAt: when(-3),
      messages: [
        {
          author: null,
          kind: "reply",
          body: "Could you send over the latest SOC 2 Type II report covering the current calendar year?",
        },
        {
          author: priya.memberId,
          kind: "reply",
          body: "Attached the report via our secure portal link. Please let us know if your infosec team needs any additional artifacts.",
        },
      ],
    },
    {
      number: 105,
      subject:
        "Feature request: Custom timesheet CSV export with billing codes",
      description:
        "Our agency bills clients on distinct accounting codes. Would love an export column for project code in timesheet reports.",
      requesterName: "David Kim",
      requesterEmail: "david@vanguard-agency.test",
      priority: "low",
      status: "open",
      category: "Feature Request",
      assignee: jamal.memberId,
      firstRespondedAt: null,
      messages: [
        {
          author: null,
          kind: "reply",
          body: "Submitting request for custom timesheet export formatting.",
        },
      ],
    },
    {
      number: 106,
      subject:
        "Can we transfer workspace ownership to a new corporate address?",
      description:
        "Our founder is stepping down as primary owner. We need to transfer root ownership to admin@hyperion.test.",
      requesterName: "Rachel Greene",
      requesterEmail: "rachel@hyperion.test",
      priority: "high",
      status: "resolved",
      category: "Account Management",
      assignee: priya.memberId,
      firstRespondedAt: when(-7),
      resolvedAt: when(-6),
      messages: [
        {
          author: null,
          kind: "reply",
          body: "Please assist with transferring the owner role.",
        },
        {
          author: priya.memberId,
          kind: "reply",
          body: "Ownership transfer completed successfully. An email verification has been dispatched to both parties.",
        },
      ],
    },
  ];

  for (const tDef of ticketDefs) {
    const [t] = await db
      .insert(schema.tickets)
      .values({
        organizationId: orgId,
        number: tDef.number,
        subject: tDef.subject,
        description: tDef.description,
        requesterName: tDef.requesterName,
        requesterEmail: tDef.requesterEmail,
        status: tDef.status,
        priority: tDef.priority,
        category: tDef.category,
        assigneeMemberId: tDef.assignee,
        createdByMemberId: priya.memberId,
        firstRespondedAt: tDef.firstRespondedAt,
        resolvedAt: (tDef as any).resolvedAt || null,
      })
      .returning();

    for (const msg of tDef.messages) {
      await db.insert(schema.ticketMessages).values({
        ticketId: t!.id,
        organizationId: orgId,
        authorMemberId: msg.author,
        kind: msg.kind,
        body: msg.body,
        createdAt: when(-2),
      });
    }
  }
  console.log(
    "✅ Seeded Support inboxes, SLAs, KB articles, and 6 full support tickets with message histories",
  );

  // 12. Chat Channels, Members, Messages & Reactions
  console.log("🌱 Seeding Chat channels, conversations and reactions...");
  const coreChannels = [
    {
      name: "general",
      topic: "Company-wide discussions, announcements, and team watercooler.",
    },
    {
      name: "announcements",
      topic: "Official company news, product releases, and major milestones.",
    },
    {
      name: "engineering",
      topic:
        "Architecture design, code reviews, staging deployments, and bug triage.",
    },
    {
      name: "design",
      topic:
        "UI/UX critiques, Figma prototypes, design tokens, and creative direction.",
    },
    {
      name: "product",
      topic: "Product roadmaps, user interviews, feature specs, and OKRs.",
    },
    {
      name: "support-triage",
      topic: "Customer escalations, urgent bug reports, and SLA tracking.",
    },
    {
      name: "random",
      topic: "Off-topic chats, music picks, recommendations, and celebrations!",
    },
  ];

  const channelMap = new Map<string, string>();
  for (const c of coreChannels) {
    const [existing] = await db
      .select({ id: schema.chatChannels.id })
      .from(schema.chatChannels)
      .where(
        and(
          eq(schema.chatChannels.organizationId, orgId),
          eq(schema.chatChannels.name, c.name),
        ),
      );

    if (existing) {
      channelMap.set(c.name, existing.id);
    } else {
      const [inserted] = await db
        .insert(schema.chatChannels)
        .values({
          organizationId: orgId,
          name: c.name,
          topic: c.topic,
          kind: "channel",
        })
        .returning({ id: schema.chatChannels.id });
      channelMap.set(c.name, inserted!.id);
    }

    // Add all members to each core channel
    const chanId = channelMap.get(c.name)!;
    for (const m of memberMap.values()) {
      await db
        .insert(schema.chatMembers)
        .values({
          channelId: chanId,
          memberId: m.memberId,
        })
        .onConflictDoNothing();
    }
  }

  // Populate rich chat conversations in #general and #engineering
  const generalId = channelMap.get("general")!;
  const engId = channelMap.get("engineering")!;
  const designId = channelMap.get("design")!;

  const chatScripts = [
    {
      chan: generalId,
      author: priya.memberId,
      body: "Good morning Acme team! ☀️ Huge congratulations to everyone on shipping Sprint 31 ahead of schedule. Let's make Q4 our strongest quarter yet!",
      reactions: ["🎉", "🚀", "❤️"],
      offset: -4,
    },
    {
      chan: generalId,
      author: daniel.memberId,
      body: "Thanks Priya! The engineering team crushed the database optimization sprint. Query response times are already down 40%.",
      reactions: ["💪", "🔥"],
      offset: -4,
    },
    {
      chan: generalId,
      author: meilin.memberId,
      body: "Design System v2 components are also live in Figma! If anyone spots any missing tokens or iconography, ping me in #design.",
      reactions: ["✨", "🎨"],
      offset: -3,
    },
    {
      chan: generalId,
      author: hannah.memberId,
      body: "Friendly reminder: Open enrollment for health benefits ends next Friday. Check your email or ping me directly if you have any questions!",
      reactions: ["👍"],
      offset: -2,
    },
    {
      chan: engId,
      author: daniel.memberId,
      body: "Hey @team, we are preparing to roll out the new tRPC batching middleware today on staging. Please keep an eye on Sentry for any connection pool anomalies.",
      reactions: ["👀"],
      offset: -2,
    },
    {
      chan: engId,
      author: tomas.memberId,
      body: "Ran the frontend Playwright test suite against the staging branch — all 85 tests green! The new virtualized list renders 5,000 tasks with zero jank.",
      reactions: ["🚀", "💯"],
      offset: -1,
    },
    {
      chan: engId,
      author: sofia.memberId,
      body: "Backend migration complete! Added composite index on (organizationId, status, createdAt) which dropped the task overview query from 140ms to 8ms. 🏎️",
      reactions: ["🙌", "🔥"],
      offset: -1,
    },
    {
      chan: engId,
      author: ravi.memberId,
      body: "Verified customer portal ticket submission webhook. Working seamlessly with zero drops on the load test.",
      reactions: ["✅"],
      offset: 0,
    },
    {
      chan: designId,
      author: meilin.memberId,
      body: "Sharing the latest mobile navigation prototype here: clean bottom tabs, tactile haptic feedback, and fluid drawer transitions.",
      reactions: ["😍", "👏"],
      offset: -1,
    },
  ];

  for (const item of chatScripts) {
    const [msg] = await db
      .insert(schema.chatMessages)
      .values({
        organizationId: orgId,
        channelId: item.chan,
        authorMemberId: item.author,
        body: item.body,
        createdAt: when(item.offset),
      })
      .returning();

    for (const emoji of item.reactions) {
      await db
        .insert(schema.chatReactions)
        .values({
          messageId: msg!.id,
          memberId: daniel.memberId,
          emoji,
        })
        .onConflictDoNothing();
    }
  }
  console.log("✅ Seeded Chat channels, members, rich messages and reactions");

  // 13. Calendar & Meetings
  console.log("🌱 Seeding Calendar events and Meetings...");
  await db.delete(schema.meetingAttendees).where(sql`1 = 1`);
  await db
    .delete(schema.meetings)
    .where(eq(schema.meetings.organizationId, orgId));
  await db
    .delete(schema.calendarEvents)
    .where(eq(schema.calendarEvents.organizationId, orgId));

  const calEvents = [
    {
      title: "Acme Group All-Hands",
      desc: "Bi-weekly company sync: roadmap updates, milestone celebrations, and open Q&A.",
      color: "violet",
      starts: when(2),
      durationHours: 1,
    },
    {
      title: "Sprint 33 Planning & Grooming",
      desc: "Backlog refinement and task estimations for the upcoming sprint cycle.",
      color: "blue",
      starts: when(3),
      durationHours: 2,
    },
    {
      title: "Design System Review",
      desc: "Reviewing updated modal dialogues, typography scales, and dark mode tokens.",
      color: "green",
      starts: when(4),
      durationHours: 1,
    },
    {
      title: "Security & SOC 2 Readiness Review",
      desc: "Audit trail review and infrastructure access controls verification.",
      color: "red",
      starts: when(5),
      durationHours: 1.5,
    },
    {
      title: "Customer Advisory Board Sync",
      desc: "Quarterly feedback session with tier-1 enterprise customers.",
      color: "amber",
      starts: when(6),
      durationHours: 1,
    },
    {
      title: "Engineering Tech Talk: Distributed Tracing",
      desc: "Deep dive into OpenTelemetry and request tracing across microservices.",
      color: "blue",
      starts: when(7),
      durationHours: 1,
    },
    {
      title: "Product Discovery: Mobile App 2.0",
      desc: "Reviewing usability session findings and onboarding drop-off funnels.",
      color: "green",
      starts: when(-3),
      durationHours: 1,
    },
  ];

  for (const ev of calEvents) {
    const ends = new Date(ev.starts.getTime() + ev.durationHours * 3600 * 1000);
    await db.insert(schema.calendarEvents).values({
      organizationId: orgId,
      createdByMemberId: priya.memberId,
      title: ev.title,
      description: ev.desc,
      color: ev.color,
      startsAt: ev.starts,
      endsAt: ends,
    });
  }

  // Meetings with video room
  const meetingList = [
    {
      title: "Sprint 32 Mid-Sprint Standup & Demo",
      agenda:
        "Review in-flight PRs, unblock backend migrations, and demo new timesheet analytics.",
      starts: when(1),
      duration: 30,
      slug: "sprint-32-mid",
      status: "scheduled",
      notes:
        "Agenda topics:\n1. Timesheet export CSV\n2. Sentry error triage\n3. Next release branch cut",
      attendees: [daniel.userId, tomas.userId, sofia.userId, ravi.userId],
    },
    {
      title: "Customer Journey Alignment: Apex Logistics",
      agenda:
        "Walkthrough of Okta SAML configuration and dedicated support SLA review.",
      starts: when(2),
      duration: 45,
      slug: "apex-logistics-sync",
      status: "scheduled",
      notes:
        "Attendees from Apex: Marcus Vance (IT Dir). Reviewing SAML handshake logs.",
      attendees: [priya.userId, daniel.userId, jamal.userId],
    },
    {
      title: "Q4 Executive Strategy & Burn Rate Review",
      agenda:
        "Review monthly payroll totals, ARR progression, and 2027 hiring plan.",
      starts: when(-5),
      duration: 60,
      slug: "exec-strategy-q4",
      status: "ended",
      notes:
        "Decision: Greenlight senior DevOps engineer hire in November. Runway approved through 2027.",
      attendees: [priya.userId, daniel.userId, hannah.userId],
    },
  ];

  for (const mDef of meetingList) {
    const [meet] = await db
      .insert(schema.meetings)
      .values({
        organizationId: orgId,
        organizerUserId: priya.userId,
        title: mDef.title,
        agenda: mDef.agenda,
        startsAt: mDef.starts,
        durationMinutes: mDef.duration,
        roomSlug: mDef.slug,
        status: mDef.status,
        notes: mDef.notes,
      })
      .returning();

    for (const uid of mDef.attendees) {
      await db.insert(schema.meetingAttendees).values({
        meetingId: meet!.id,
        userId: uid,
        response: "yes",
      });
    }
  }
  console.log("✅ Seeded Calendar events and Meetings with attendees");

  // 14. Files (disk + database)
  console.log("🌱 Seeding Files library...");
  await db.delete(schema.files).where(eq(schema.files.organizationId, orgId));

  const uploadsDir = path.resolve(
    process.env.FILE_STORAGE_DIR ?? path.join(process.cwd(), ".uploads"),
    orgId,
  );
  await mkdir(uploadsDir, { recursive: true });

  const fileDefs = [
    {
      name: "Acme_Group_Brand_Guidelines_2026.pdf",
      mime: "application/pdf",
      content:
        "PDF mock content: Acme Group Brand Guidelines & Design Tokens 2026",
      size: 245000,
    },
    {
      name: "SOC2_Type_II_Security_Whitepaper.pdf",
      mime: "application/pdf",
      content:
        "PDF mock content: SOC 2 Type II Security & Controls Audit Report",
      size: 512000,
    },
    {
      name: "System_Architecture_Diagram.png",
      mime: "image/png",
      content: "PNG mock binary data representing architecture diagram",
      size: 840000,
      w: 1920,
      h: 1080,
    },
    {
      name: "Q4_Revenue_Financial_Model.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: "Spreadsheet mock content: Q4 Revenue Forecast & Headcount Plan",
      size: 128000,
    },
    {
      name: "Acme_Design_Tokens_v2.json",
      mime: "application/json",
      content: JSON.stringify(
        {
          version: "2.1.0",
          tokens: { primary: "#6366f1", surface: "#18181b" },
        },
        null,
        2,
      ),
      size: 1420,
    },
    {
      name: "Employee_Handbook_and_Benefits.pdf",
      mime: "application/pdf",
      content:
        "PDF mock content: Acme Group Employee Handbook, PTO Policy, and Benefits Overview",
      size: 380000,
    },
  ];

  for (const f of fileDefs) {
    const fileId = randomUUID();
    const diskFileName = `${fileId}${path.extname(f.name)}`;
    const storageKey = `${orgId}/${diskFileName}`;
    await writeFile(
      path.join(uploadsDir, diskFileName),
      Buffer.from(f.content),
    );

    await db.insert(schema.files).values({
      id: fileId,
      organizationId: orgId,
      uploadedByMemberId: priya.memberId,
      name: f.name,
      mimeType: f.mime,
      size: f.size,
      width: f.w || null,
      height: f.h || null,
      storageKey,
    });
  }
  console.log(
    "✅ Seeded 6 files to library (with disk persistence in .uploads)",
  );

  // 15. Whiteboards
  console.log("🌱 Seeding Whiteboards with diagram elements...");
  await db
    .delete(schema.whiteboards)
    .where(eq(schema.whiteboards.organizationId, orgId));

  const archElements = [
    {
      id: "b1",
      type: "rect",
      x: 100,
      y: 150,
      w: 220,
      h: 120,
      color: "#3b82f6",
      text: "Next.js Web App\n(Apps/Web)",
    },
    { id: "b2", type: "arrow", x: 320, y: 210, w: 100, h: 0, color: "#9ca3af" },
    {
      id: "b3",
      type: "rect",
      x: 420,
      y: 150,
      w: 220,
      h: 120,
      color: "#10b981",
      text: "tRPC API Router\n(@zentro/api)",
    },
    { id: "b4", type: "arrow", x: 640, y: 210, w: 100, h: 0, color: "#9ca3af" },
    {
      id: "b5",
      type: "rect",
      x: 740,
      y: 150,
      w: 220,
      h: 120,
      color: "#8b5cf6",
      text: "PostgreSQL (Neon)\n(@zentro/db)",
    },
    {
      id: "b6",
      type: "sticky",
      x: 440,
      y: 320,
      w: 180,
      h: 140,
      color: "#fbbf24",
      text: "Note: Enforce permission checks on every tRPC procedure!",
    },
    {
      id: "b7",
      type: "rect",
      x: 420,
      y: 490,
      w: 220,
      h: 100,
      color: "#ef4444",
      text: "Background Workers\n& Cron Automations",
    },
    { id: "b8", type: "arrow", x: 530, y: 270, w: 0, h: 220, color: "#9ca3af" },
  ];

  await db.insert(schema.whiteboards).values([
    {
      organizationId: orgId,
      createdByMemberId: daniel.memberId,
      title: "Acme Group Core System Architecture & Microservices",
      elements: archElements,
      updatedAt: new Date(),
    },
    {
      organizationId: orgId,
      createdByMemberId: meilin.memberId,
      title: "User Onboarding & Activation Journey 2026",
      elements: [
        {
          id: "f1",
          type: "ellipse",
          x: 100,
          y: 200,
          w: 160,
          h: 100,
          color: "#3b82f6",
          text: "Landing Page",
        },
        {
          id: "f2",
          type: "arrow",
          x: 260,
          y: 250,
          w: 80,
          h: 0,
          color: "#9ca3af",
        },
        {
          id: "f3",
          type: "rect",
          x: 340,
          y: 200,
          w: 180,
          h: 100,
          color: "#10b981",
          text: "One-Click SSO / Auth",
        },
        {
          id: "f4",
          type: "arrow",
          x: 520,
          y: 250,
          w: 80,
          h: 0,
          color: "#9ca3af",
        },
        {
          id: "f5",
          type: "rect",
          x: 600,
          y: 200,
          w: 200,
          h: 100,
          color: "#8b5cf6",
          text: "Workspace First Project",
        },
        {
          id: "f6",
          type: "sticky",
          x: 350,
          y: 340,
          w: 160,
          h: 120,
          color: "#f472b6",
          text: "Activation milestone: user creates first task in 3 mins.",
        },
      ],
      updatedAt: new Date(),
    },
    {
      organizationId: orgId,
      createdByMemberId: jamal.memberId,
      title: "Q4 Product Strategy & Release Milestones",
      elements: [
        {
          id: "m1",
          type: "rect",
          x: 120,
          y: 150,
          w: 240,
          h: 160,
          color: "#6366f1",
          text: "Milestone 1: Web App Redesign\nDue: Nov 15\nOwner: Mei Lin & Tomás",
        },
        {
          id: "m2",
          type: "rect",
          x: 400,
          y: 150,
          w: 240,
          h: 160,
          color: "#ec4899",
          text: "Milestone 2: Mobile App Beta\nDue: Nov 30\nOwner: Daniel & Sofia",
        },
        {
          id: "m3",
          type: "rect",
          x: 680,
          y: 150,
          w: 240,
          h: 160,
          color: "#14b8a6",
          text: "Milestone 3: Enterprise SSO & SCIM\nDue: Dec 15\nOwner: Daniel",
        },
      ],
      updatedAt: new Date(),
    },
  ]);
  console.log(
    "✅ Seeded 3 rich Whiteboards with canvas shapes and sticky notes",
  );

  // 16. Mail Messages & Threads
  console.log("🌱 Seeding Mail conversations...");
  await db.delete(schema.mailRecipients).where(sql`1 = 1`);
  await db
    .delete(schema.mailMessages)
    .where(eq(schema.mailMessages.organizationId, orgId));

  const mailThreads = [
    {
      subject: "Q4 Product Roadmap Alignment & Resource Allocation",
      sender: priya.memberId,
      to: [daniel.memberId, jamal.memberId],
      body: `Hi Daniel and Jamal,\n\nFollowing our executive sync, we have finalized the Q4 priorities:\n\n1. Website Redesign & Brand Refresh (Launch Nov 15)\n2. Mobile App Beta for Enterprise Customers (Dec 1)\n3. SOC 2 Type II Audit Compliance\n\nPlease review your team allocations and confirm if any additional contractor support is needed.\n\nBest,\nPriya`,
      replies: [
        {
          sender: daniel.memberId,
          to: [priya.memberId, jamal.memberId],
          body: `Thanks Priya. Engineering allocations are locked in. Sofia and Tomás are leading the core web migration, while Ravi is dedicated to customer support and integrations. We are on track for Nov 15.`,
        },
      ],
    },
    {
      subject: "SOC 2 Type II Final Report Received - Clean Opinion!",
      sender: sofia.memberId,
      to: [priya.memberId, daniel.memberId],
      body: `Great news team,\n\nOur auditor just issued the finalized SOC 2 Type II report with a clean unqualified opinion. Zero findings or remediation requirements across all Trust Services Criteria.\n\nThe final PDF has been uploaded to the Files library for customer sharing.\n\nCheers,\nSofia`,
      replies: [
        {
          sender: priya.memberId,
          to: [sofia.memberId, daniel.memberId],
          body: `Incredible work Sofia and Daniel! This is a massive milestone for closing enterprise pipeline deals.`,
        },
      ],
    },
    {
      subject: "Company Benefits Open Enrollment - Action Required by Nov 20",
      sender: hannah.memberId,
      to: [priya.memberId, daniel.memberId, meilin.memberId, tomas.memberId],
      body: `Hello team,\n\nOpen enrollment for Acme Group medical, dental, and vision insurance is officially underway. If you wish to make changes to your elections for next year, please submit them through the portal before November 20th.\n\nReach out if you need assistance!\n\nHannah`,
      replies: [],
    },
  ];

  for (const t of mailThreads) {
    const threadId = randomUUID();
    const [msg] = await db
      .insert(schema.mailMessages)
      .values({
        id: threadId,
        organizationId: orgId,
        senderMemberId: t.sender,
        threadId,
        subject: t.subject,
        body: t.body,
        sentAt: when(-5),
      })
      .returning();

    for (const toId of t.to) {
      await db.insert(schema.mailRecipients).values({
        messageId: msg!.id,
        memberId: toId,
        kind: "to",
        readAt: when(-4),
      });
    }

    for (let rIdx = 0; rIdx < t.replies.length; rIdx++) {
      const rep = t.replies[rIdx]!;
      const repId = randomUUID();
      const [repMsg] = await db
        .insert(schema.mailMessages)
        .values({
          id: repId,
          organizationId: orgId,
          senderMemberId: rep.sender,
          threadId,
          subject: `Re: ${t.subject}`,
          body: rep.body,
          sentAt: when(-3 + rIdx),
        })
        .returning();

      for (const toId of rep.to) {
        await db.insert(schema.mailRecipients).values({
          messageId: repMsg!.id,
          memberId: toId,
          kind: "to",
          readAt: when(-2),
        });
      }
    }
  }
  console.log("✅ Seeded Mail threads, messages, and recipient states");

  // 17. Admin, Security & Webhooks
  console.log(
    "🌱 Seeding Admin API keys, Webhooks, IP allowlist, and Automations...",
  );
  await db
    .delete(schema.webhookDeliveries)
    .where(eq(schema.webhookDeliveries.organizationId, orgId));
  await db
    .delete(schema.webhookEndpoints)
    .where(eq(schema.webhookEndpoints.organizationId, orgId));
  await db
    .delete(schema.apiKeys)
    .where(eq(schema.apiKeys.organizationId, orgId));
  await db
    .delete(schema.ipAllowlist)
    .where(eq(schema.ipAllowlist.organizationId, orgId));
  await db
    .delete(schema.retentionPolicies)
    .where(eq(schema.retentionPolicies.organizationId, orgId));
  await db
    .delete(schema.automations)
    .where(eq(schema.automations.organizationId, orgId));
  await db
    .delete(schema.intakeForms)
    .where(eq(schema.intakeForms.organizationId, orgId));

  // API Keys
  const fakeHash = (str: string) =>
    createHash("sha256").update(str).digest("hex");
  await db.insert(schema.apiKeys).values([
    {
      organizationId: orgId,
      createdByUserId: priya.userId,
      name: "Production Ingest Pipeline Key",
      prefix: "zentro_live_9a7b",
      keyHash: fakeHash("key-1-live-secret"),
      lastUsedAt: when(-1),
      expiresAt: when(365),
    },
    {
      organizationId: orgId,
      createdByUserId: daniel.userId,
      name: "CI/CD Deployment Token",
      prefix: "zentro_ci_42cd",
      keyHash: fakeHash("key-2-ci-secret"),
      lastUsedAt: when(-2),
      expiresAt: when(180),
    },
  ]);

  // Webhook Endpoints & Deliveries
  const [hook1] = await db
    .insert(schema.webhookEndpoints)
    .values({
      organizationId: orgId,
      createdByUserId: daniel.userId,
      url: "https://api.github.com/repos/acmegroup/platform/dispatches",
      secret: "whsec_acmegroup_github_live_secret",
      events: ["task.created", "task.updated", "sprint.completed"],
      enabled: true,
    })
    .returning();

  const [hook2] = await db
    .insert(schema.webhookEndpoints)
    .values({
      organizationId: orgId,
      createdByUserId: priya.userId,
      url: "https://hooks.slack.com/services/T0123/B4567/abc123livewebhook",
      secret: "whsec_acmegroup_slack_live_secret",
      events: ["ticket.created", "ticket.resolved"],
      enabled: true,
    })
    .returning();

  await db.insert(schema.webhookDeliveries).values([
    {
      endpointId: hook1!.id,
      organizationId: orgId,
      event: "task.created",
      payload: {
        taskId: allTasks[0]?.id,
        taskKey: "MA-1",
        name: "Deploy auth middleware",
        timestamp: when(-1).toISOString(),
      },
      status: "delivered",
      attempts: 1,
      responseStatus: 200,
      deliveredAt: when(-1),
    },
    {
      endpointId: hook2!.id,
      organizationId: orgId,
      event: "ticket.created",
      payload: {
        ticketNumber: 101,
        subject: "SAML SSO handshake issue",
        priority: "urgent",
      },
      status: "delivered",
      attempts: 1,
      responseStatus: 200,
      deliveredAt: when(-1),
    },
  ]);

  // IP Allowlist
  await db.insert(schema.ipAllowlist).values([
    {
      organizationId: orgId,
      cidr: "198.51.100.0/24",
      label: "Acme Group HQ - San Francisco Office",
    },
    {
      organizationId: orgId,
      cidr: "203.0.113.0/24",
      label: "Corporate WireGuard VPN Gateway",
    },
  ]);

  // Retention Policies
  await db.insert(schema.retentionPolicies).values([
    { organizationId: orgId, dataType: "chat_messages", days: 365 },
    { organizationId: orgId, dataType: "closed_tickets", days: 730 },
  ]);

  // Intake Forms
  await db.insert(schema.intakeForms).values([
    {
      organizationId: orgId,
      name: "Enterprise Customer Feedback & Requests",
      description:
        "Direct channel for enterprise pilot customers to suggest improvements or report issues.",
      fields: [
        { id: "f_name", label: "Your Full Name", type: "name", required: true },
        { id: "f_email", label: "Work Email", type: "email", required: true },
        {
          id: "f_type",
          label: "Request Type",
          type: "choice",
          required: true,
          options: ["Bug Report", "Feature Request", "Account Inquiry"],
        },
        {
          id: "f_desc",
          label: "Detailed Description",
          type: "longtext",
          required: true,
        },
      ],
      enabled: true,
    },
  ]);

  // Automations
  await db.insert(schema.automations).values([
    {
      organizationId: orgId,
      name: "Auto-escalate Urgent Tickets to Engineering Lead",
      description:
        "Automatically notifies #support-triage and assigns urgent customer tickets to Daniel.",
      enabled: true,
      triggerEvent: "ticket.created",
      triggerConfig: { priority: "urgent" },
      actionType: "ticket.assign",
      actionConfig: { assigneeMemberId: daniel.memberId },
      runCount: 14,
      lastRunAt: when(-1),
      createdByMemberId: priya.memberId,
    },
    {
      organizationId: orgId,
      name: "Notify Slack Channel on Sprint Completion",
      description:
        "Posts sprint velocity summary to #general when a sprint status changes to completed.",
      enabled: true,
      triggerEvent: "sprint.completed",
      triggerConfig: {},
      actionType: "chat.post_message",
      actionConfig: { channelName: "general" },
      runCount: 6,
      lastRunAt: when(-14),
      createdByMemberId: daniel.memberId,
    },
  ]);

  // Task Recurrence
  await db
    .delete(schema.taskRecurrences)
    .where(eq(schema.taskRecurrences.organizationId, orgId));
  await db.insert(schema.taskRecurrences).values([
    {
      organizationId: orgId,
      projectId: websiteProject.id,
      name: "Weekly Dependency & Vulnerability Security Audit",
      description:
        "Run pnpm audit and Dependabot check across all monorepo packages.",
      priority: "high",
      assignedToMemberId: sofia.memberId,
      dueInDays: 2,
      cadence: "weekly",
      nextRunAt: when(3),
      lastRunAt: when(-4),
      enabled: true,
      createdByMemberId: daniel.memberId,
    },
    {
      organizationId: orgId,
      projectId: websiteProject.id,
      name: "Monthly Financial Reconciliation & Invoicing Review",
      description:
        "Audit customer usage, billable seat counts, and payment gateway retry queues.",
      priority: "medium",
      assignedToMemberId: priya.memberId,
      dueInDays: 3,
      cadence: "monthly",
      nextRunAt: when(20),
      lastRunAt: when(-10),
      enabled: true,
      createdByMemberId: priya.memberId,
    },
  ]);

  // 18. Favorites & Task Activity Events
  await db
    .delete(schema.favorites)
    .where(eq(schema.favorites.organizationId, orgId));
  await db.insert(schema.favorites).values([
    {
      organizationId: orgId,
      userId: priya.userId,
      targetType: "project",
      targetId: websiteProject.id,
    },
    {
      organizationId: orgId,
      userId: priya.userId,
      targetType: "project",
      targetId: mobileProject.id,
    },
    {
      organizationId: orgId,
      userId: daniel.userId,
      targetType: "project",
      targetId: websiteProject.id,
    },
  ]);

  // Task Activity Events
  await db
    .delete(schema.taskActivityEvents)
    .where(eq(schema.taskActivityEvents.organizationId, orgId));
  for (let i = 0; i < 20; i++) {
    const t = allTasks[i % allTasks.length]!;
    const actor = [daniel, meilin, tomas, sofia, ravi][i % 5]!;
    await db.insert(schema.taskActivityEvents).values({
      organizationId: orgId,
      taskId: t.id,
      actorMemberId: actor.memberId,
      type: "status_changed",
      field: "status",
      fromValue: "todo",
      toValue: t.status,
      createdAt: when(-((i % 7) + 1)),
    });
  }

  console.log(
    "🎉 Acme Group comprehensive mock data seeding completed successfully!",
  );
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
