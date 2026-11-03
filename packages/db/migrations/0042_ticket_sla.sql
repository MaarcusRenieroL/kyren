ALTER TABLE "ticket" ADD COLUMN "firstRespondedAt" timestamp;
--> statement-breakpoint
UPDATE "ticket" SET "firstRespondedAt" = (
	SELECT min("createdAt") FROM "ticketMessage"
	WHERE "ticketMessage"."ticketId" = "ticket"."id" AND "ticketMessage"."kind" = 'reply'
);
--> statement-breakpoint
CREATE TABLE "ticketSlaPolicy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"priority" text NOT NULL,
	"firstResponseMinutes" integer,
	"resolutionMinutes" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_sla_org_priority_unique" ON "ticketSlaPolicy" ("organizationId", "priority");
