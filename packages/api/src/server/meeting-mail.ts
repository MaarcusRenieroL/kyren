import { and, eq, ne } from "@zentro/db/drizzle";
import { meetingAttendees, users } from "@zentro/db/schema";

import type { DbHandle } from "./access";

export type MeetingMail = {
  kind: "invite" | "cancel" | "reminder";
  to: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  organizer: string;
  /** Page in the app. The video room link is never put in an email. */
  path: string;
};

type Mailer = (mail: MeetingMail) => Promise<void>;

let override: Mailer | null = null;

/** Replaces how mail is sent (tests); null goes back to the real thing. */
export function setMeetingMailer(mailer: Mailer | null) {
  override = mailer;
}

async function realMailer(mail: MeetingMail) {
  // Reserved test addresses never receive real mail.
  if (mail.to.toLowerCase().endsWith(".test")) return;

  const { sendMeetingEmail } = await import("@zentro/auth");

  await sendMeetingEmail(mail);
}

type MeetingRow = {
  id: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  organizerUserId: string;
};

/**
 * Emails a meeting's attendees. A failed send is logged and skipped: mail
 * trouble must never stop a meeting from being scheduled or canceled.
 */
export async function mailMeeting(
  db: DbHandle,
  meeting: MeetingRow,
  kind: MeetingMail["kind"],
  options: { includeOrganizer?: boolean } = {},
) {
  const [organizer] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, meeting.organizerUserId))
    .limit(1);
  const people = await db
    .select({ email: users.email, userId: users.id })
    .from(meetingAttendees)
    .innerJoin(users, eq(users.id, meetingAttendees.userId))
    .where(
      and(
        eq(meetingAttendees.meetingId, meeting.id),
        // Someone who said no does not need a nudge.
        ne(meetingAttendees.response, "no"),
      ),
    );
  const send = override ?? realMailer;
  let sent = 0;

  for (const person of people) {
    if (
      person.userId === meeting.organizerUserId &&
      !options.includeOrganizer
    ) {
      continue;
    }

    try {
      await send({
        kind,
        to: person.email,
        title: meeting.title,
        startsAt: meeting.startsAt,
        durationMinutes: meeting.durationMinutes,
        organizer: organizer?.name ?? "Someone",
        path: `/calendar/meetings/${meeting.id}`,
      });
      sent += 1;
    } catch (error) {
      console.error("[meetings] could not send a meeting email", error);
    }
  }

  return sent;
}
