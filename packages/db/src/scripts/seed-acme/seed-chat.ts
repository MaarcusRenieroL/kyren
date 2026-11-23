import { and, eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { when, type SeedContext } from "./context";

export async function seedChat(ctx: SeedContext) {
  const { orgId, members, memberMap, websiteProject, mobileProject } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

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


}
