import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { when, type SeedContext } from "./context";

export async function seedAdmin(ctx: SeedContext) {
  const { orgId, members, websiteProject } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

  const allTasks = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.organizationId, orgId));

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


}
