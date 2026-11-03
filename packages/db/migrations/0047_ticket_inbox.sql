CREATE TABLE "ticketInbox" (
	"organizationId" uuid PRIMARY KEY NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"token" text NOT NULL UNIQUE,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketInbound" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"messageId" text NOT NULL,
	"ticketId" uuid NOT NULL REFERENCES "ticket"("id") ON DELETE CASCADE,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_inbound_message_unique" ON "ticketInbound" ("organizationId", "messageId");
