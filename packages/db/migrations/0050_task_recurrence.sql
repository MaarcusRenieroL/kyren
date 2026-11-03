CREATE TABLE "taskRecurrence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignedToMemberId" uuid REFERENCES "member"("id") ON DELETE SET NULL,
	"dueInDays" integer,
	"cadence" text NOT NULL,
	"nextRunAt" timestamp NOT NULL,
	"lastRunAt" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdByMemberId" uuid REFERENCES "member"("id") ON DELETE SET NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "taskRecurrence_due_idx" ON "taskRecurrence" USING btree ("enabled","nextRunAt");
--> statement-breakpoint
CREATE INDEX "taskRecurrence_project_idx" ON "taskRecurrence" USING btree ("projectId");
