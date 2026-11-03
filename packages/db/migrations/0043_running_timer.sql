CREATE TABLE "runningTimer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"taskId" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
	"startedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "running_timer_one_per_person" ON "runningTimer" ("organizationId", "userId");
