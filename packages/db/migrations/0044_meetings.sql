CREATE TABLE "meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
	"organizerUserId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"agenda" text,
	"startsAt" timestamp NOT NULL,
	"durationMinutes" integer NOT NULL,
	"roomSlug" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"summary" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "meeting_org_start_idx" ON "meeting" ("organizationId", "startsAt");
--> statement-breakpoint
CREATE TABLE "meetingAttendee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meetingId" uuid NOT NULL REFERENCES "meeting"("id") ON DELETE CASCADE,
	"userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"response" text DEFAULT 'invited' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_attendee_unique" ON "meetingAttendee" ("meetingId", "userId");
--> statement-breakpoint
CREATE INDEX "meeting_attendee_user_idx" ON "meetingAttendee" ("userId");
