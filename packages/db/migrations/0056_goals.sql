CREATE TABLE "objective" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"description" text,
	"period" text,
	"status" text DEFAULT 'active' NOT NULL,
	"ownerMemberId" uuid REFERENCES "member"("id") ON DELETE SET NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "objective_organization_idx" ON "objective" USING btree ("organizationId");
--> statement-breakpoint
CREATE TABLE "keyResult" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"objectiveId" uuid NOT NULL REFERENCES "objective"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"kind" text DEFAULT 'metric' NOT NULL,
	"startValue" double precision DEFAULT 0 NOT NULL,
	"targetValue" double precision DEFAULT 100 NOT NULL,
	"currentValue" double precision DEFAULT 0 NOT NULL,
	"unit" text,
	"ownerMemberId" uuid REFERENCES "member"("id") ON DELETE SET NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "keyResult_objective_idx" ON "keyResult" USING btree ("objectiveId");
--> statement-breakpoint
CREATE TABLE "keyResultTask" (
	"keyResultId" uuid NOT NULL REFERENCES "keyResult"("id") ON DELETE CASCADE,
	"taskId" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
	PRIMARY KEY ("keyResultId", "taskId")
);
