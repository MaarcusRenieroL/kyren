import { and, eq, gte, isNull, lte } from "@kyren/db/drizzle";
import { meetings } from "@kyren/db/schema";

import type { DbHandle } from "./access";
import { mailMeeting } from "./meeting-mail";

/** How long before the start the reminder goes out. */
const REMIND_BEFORE_MS = 15 * 60_000;

/**
 * Emails everyone still coming to a meeting that starts within 15 minutes.
 * Each meeting is claimed first, so overlapping runs never send twice.
 * Returns how many meetings were reminded.
 */
export async function sendDueMeetingReminders(
  db: DbHandle,
  organizationId?: string,
) {
  const now = new Date();
  const due = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.status, "scheduled"),
        isNull(meetings.reminderSentAt),
        gte(meetings.startsAt, now),
        lte(meetings.startsAt, new Date(now.getTime() + REMIND_BEFORE_MS)),
        organizationId
          ? eq(meetings.organizationId, organizationId)
          : undefined,
      ),
    )
    .limit(100);
  let reminded = 0;

  for (const meeting of due) {
    const claimed = await db
      .update(meetings)
      .set({ reminderSentAt: new Date() })
      .where(and(eq(meetings.id, meeting.id), isNull(meetings.reminderSentAt)))
      .returning({ id: meetings.id });

    if (!claimed.length) continue;

    await mailMeeting(db, meeting, "reminder", { includeOrganizer: true });
    reminded += 1;
  }

  return reminded;
}

let lastLazyRun = 0;

/**
 * A cheap check from a page load, at most once a minute per server. Tests run
 * the sweep themselves, so a page load in one test file never claims the
 * meetings of another.
 */
export async function sendDueMeetingRemindersLazily(db: DbHandle) {
  if (process.env.VITEST) return;

  if (Date.now() - lastLazyRun < 60_000) return;

  lastLazyRun = Date.now();

  try {
    await sendDueMeetingReminders(db);
  } catch (error) {
    console.error("[meetings] reminders failed", error);
  }
}
