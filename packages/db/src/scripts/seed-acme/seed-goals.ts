import { eq, sql } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { dateStr, type SeedContext } from "./context";

export async function seedGoals(ctx: SeedContext) {
  const { orgId, members, teamMap } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

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


}
