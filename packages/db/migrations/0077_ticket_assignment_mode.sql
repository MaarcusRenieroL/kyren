ALTER TABLE "ticketAssignmentRule" ADD COLUMN "mode" text DEFAULT 'round_robin' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ticketAssignmentRule" ADD CONSTRAINT "ticketAssignmentRule_mode_check" CHECK ("mode" IN ('round_robin', 'least_open'));
