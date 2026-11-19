CREATE TABLE "ticketAssignmentRule" (
	"organizationId" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"memberIds" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"lastMemberId" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticketAssignmentRule" ADD CONSTRAINT "ticketAssignmentRule_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
