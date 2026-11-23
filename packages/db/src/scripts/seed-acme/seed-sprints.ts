import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { dateStr, when, type SeedContext } from "./context";

export async function seedSprints(ctx: SeedContext) {
  const { orgId, websiteProject, mobileProject } = ctx;
  console.log("🌱 Seeding Sprints...");

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


  return { sprintPast: sprintPast!, sprintActive: sprintActive!, sprintPlanned: sprintPlanned! };
}
