/**
 * A one-event calendar file (RFC 5545). Calendar apps show it in the
 * reader's own timezone, which an email body cannot do, and the same UID
 * lets a later cancellation remove the event it added.
 */
export function meetingIcs(meeting: {
  uid: string;
  method: "REQUEST" | "CANCEL";
  title: string;
  startsAt: Date;
  durationMinutes: number;
  organizer: string;
  /** The address invites are sent from; calendar apps need an organizer. */
  organizerEmail: string;
  /** Who this copy is for. */
  attendeeEmail: string;
  url: string;
  now?: Date;
}) {
  const end = new Date(
    meeting.startsAt.getTime() + meeting.durationMinutes * 60_000,
  );
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zentro//Meetings//EN",
    `METHOD:${meeting.method}`,
    "BEGIN:VEVENT",
    `UID:${text(meeting.uid)}`,
    `DTSTAMP:${stamp(meeting.now ?? new Date())}`,
    `DTSTART:${stamp(meeting.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `ORGANIZER;CN=${param(meeting.organizer)}:mailto:${meeting.organizerEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:${meeting.attendeeEmail}`,
    `SUMMARY:${text(meeting.title)}`,
    `DESCRIPTION:${text(`Organizer: ${meeting.organizer}\nOpen in Zentro: ${meeting.url}`)}`,
    `URL:${meeting.url}`,
    // A cancellation must outrank the invite it replaces.
    `SEQUENCE:${meeting.method === "CANCEL" ? 1 : 0}`,
    `STATUS:${meeting.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** A parameter value is quoted, and quotes cannot appear inside it. */
function param(value: string) {
  return `"${value.replace(/"/g, "'")}"`;
}

/** 20261118T143000Z */
function stamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function text(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 characters continue on the next line after a space. */
function fold(line: string) {
  const parts: string[] = [];

  for (
    let rest = line;
    rest.length;
    rest = rest.slice(parts.length === 1 ? 75 : 74)
  ) {
    parts.push(rest.slice(0, parts.length === 0 ? 75 : 74));
  }

  return parts.join("\r\n ");
}
