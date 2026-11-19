-- All-day events used to be saved as the creator's local midnight. They are
-- now midnight UTC of their date; rounding to the nearest UTC midnight
-- recovers the intended date for offsets from about -11h to +12h.
UPDATE "calendarEvent"
SET "startsAt" = date_trunc('day', "startsAt" + interval '12 hours')
WHERE "allDay" AND "startsAt" <> date_trunc('day', "startsAt");
--> statement-breakpoint
UPDATE "calendarEvent"
SET "endsAt" = date_trunc('day', "endsAt" + interval '12 hours')
WHERE "allDay" AND "endsAt" <> date_trunc('day', "endsAt");
