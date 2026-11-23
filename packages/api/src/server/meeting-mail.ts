import { and, eq, ne } from "@kyren/db/drizzle";
import { meetingAttendees, users } from "@kyren/db/schema";

import type { db as database } from "@kyren/db";

import type { DbHandle } from "./access";
import { enqueueJob, registerJobHandler } from "./jobs";

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

  const { sendMeetingEmail } = await import("@kyren/auth");

  await sendMeetingEmail(mail);
}

registerJobHandler("meeting_mail", async (payload) => {
  await (override ?? realMailer)({
    ...(payload as unknown as MeetingMail),
    startsAt: new Date(String(payload.startsAt)),
  });
});

type MeetingRow = {
  id: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  organizerUserId: string;
};

/**
 * Emails a meeting's attendees. A failed send is logged and, for invites and
 * cancellations, queued to be tried again: mail trouble must never stop a
 * meeting from being scheduled or canceled.
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

    const mail: MeetingMail = {
      kind,
      to: person.email,
      title: meeting.title,
      startsAt: meeting.startsAt,
      durationMinutes: meeting.durationMinutes,
      organizer: organizer?.name ?? "Someone",
      path: `/calendar/meetings/${meeting.id}`,
    };

    try {
      await send(mail);
      sent += 1;
    } catch (error) {
      console.error("[meetings] could not send a meeting email", error);

      // A reminder that arrives after the meeting started is no use; invites
      // and cancellations are still worth retrying.
      if (kind !== "reminder") {
        await enqueueJob(db as unknown as typeof database, "meeting_mail", {
          ...mail,
          startsAt: mail.startsAt.toISOString(),
        }).catch(() => undefined);
      }
    }
  }

  return sent;
}
