import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { when, type SeedContext } from "./context";

export async function seedTasks(
  ctx: SeedContext,
  sprints: {
    sprintPast: typeof schema.sprints.$inferSelect;
    sprintActive: typeof schema.sprints.$inferSelect;
    sprintPlanned: typeof schema.sprints.$inferSelect;
  },
) {
  const { orgId, members, websiteProject, mobileProject } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;
  const { sprintPast, sprintActive, sprintPlanned } = sprints;

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


}
