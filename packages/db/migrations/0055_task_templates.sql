CREATE TABLE "taskTemplate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"taskDescription" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"estimatePoints" integer,
	"dueInDays" integer,
	"subtasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdByMemberId" uuid REFERENCES "member"("id") ON DELETE SET NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "taskTemplate_organization_idx" ON "taskTemplate" USING btree ("organizationId");
