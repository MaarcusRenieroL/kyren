import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { type SeedContext } from "./context";

export async function seedKb(ctx: SeedContext) {
  const { orgId, members } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

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


}
