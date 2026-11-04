ALTER TABLE "organization" ADD COLUMN "suspendedAt" timestamp;
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "suspendedReason" text;
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "deletionScheduledFor" timestamp;
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "featureFlags" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "limits" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
CREATE TABLE "platformSetting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platformIpAllowlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cidr" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platformAnnouncement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"startsAt" timestamp DEFAULT now() NOT NULL,
	"endsAt" timestamp,
	"withdrawnAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platformAuditEvent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actorId" uuid NOT NULL,
	"actorEmail" text NOT NULL,
	"action" text NOT NULL,
	"organizationId" uuid,
	"targetType" text NOT NULL,
	"targetId" text,
	"label" text DEFAULT '' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "platformAudit_created_idx" ON "platformAuditEvent" USING btree ("createdAt");
--> statement-breakpoint
CREATE INDEX "platformAudit_org_idx" ON "platformAuditEvent" USING btree ("organizationId");
