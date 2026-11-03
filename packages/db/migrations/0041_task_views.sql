CREATE TABLE "taskView" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"ownerUserId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"config" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "task_view_owner_name_unique" ON "taskView" ("organizationId", "ownerUserId", lower("name"));
--> statement-breakpoint
CREATE INDEX "task_view_org_idx" ON "taskView" ("organizationId");
