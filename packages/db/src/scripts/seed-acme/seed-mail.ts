import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { when, type SeedContext } from "./context";

export async function seedMail(ctx: SeedContext) {
  const { orgId, members } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

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


}
