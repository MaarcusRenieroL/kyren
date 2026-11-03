CREATE TABLE "sprint" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"goal" text,
	"startsOn" date NOT NULL,
	"endsOn" date NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"committedPoints" integer,
	"completedPoints" integer,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sprint_one_active_per_project" ON "sprint" ("projectId") WHERE "status" = 'active';
--> statement-breakpoint
CREATE INDEX "sprint_project_idx" ON "sprint" ("projectId", "startsOn");
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "sprintId" uuid REFERENCES "sprint"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "task_sprint_idx" ON "task" ("sprintId");
--> statement-breakpoint
UPDATE "task" SET "completedAt" = "updatedAt" WHERE "status" = 'done' AND "completedAt" IS NULL;
