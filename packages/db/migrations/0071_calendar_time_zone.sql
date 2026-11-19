ALTER TABLE "calendarEvent" ADD COLUMN "timeZone" text DEFAULT 'UTC' NOT NULL;
--> statement-breakpoint
ALTER TABLE "calendarEvent" ADD CONSTRAINT "calendarEvent_repeat_check" CHECK ("repeat" IS NULL OR "repeat" IN ('daily', 'weekly', 'monthly'));
