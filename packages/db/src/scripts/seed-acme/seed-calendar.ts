import { eq, sql } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { when, type SeedContext } from "./context";

export async function seedCalendar(ctx: SeedContext) {
  const { orgId, members } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

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


}
