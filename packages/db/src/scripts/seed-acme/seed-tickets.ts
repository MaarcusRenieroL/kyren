import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { when, type SeedContext } from "./context";

export async function seedTickets(ctx: SeedContext) {
  const { orgId, members } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

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


}
