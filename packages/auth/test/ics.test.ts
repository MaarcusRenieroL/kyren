import { describe, expect, it } from "vitest";

import { meetingIcs } from "../src/lib/ics";

const base = {
  uid: "meeting-1@kyren",
  title: "Plan, review; ship",
  startsAt: new Date("2026-11-18T14:30:00Z"),
  durationMinutes: 45,
  organizer: "Priya",
  organizerEmail: "meet@kyren.example",
  attendeeEmail: "ana@example.test",
  url: "https://kyren.example/calendar/meetings/1",
  now: new Date("2026-11-18T10:00:00Z"),
};

describe("meeting calendar file", () => {
  it("gives UTC start and end so each calendar shows local time", () => {
    const ics = meetingIcs({ ...base, method: "REQUEST" });

    expect(ics).toContain("DTSTART:20261118T143000Z");
    expect(ics).toContain("DTEND:20261118T151500Z");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("SUMMARY:Plan\\, review\\; ship");
    expect(ics).toContain('ORGANIZER;CN="Priya":mailto:meet@kyren.example');
    expect(ics).toContain(
      "ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:ana@example.test",
    );
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("cancels the same event with a higher sequence", () => {
    const ics = meetingIcs({ ...base, method: "CANCEL" });

    expect(ics).toContain("UID:meeting-1@kyren");
    expect(ics).toContain("SEQUENCE:1");
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("folds long lines and keeps every line within 75 characters", () => {
    const ics = meetingIcs({
      ...base,
      method: "REQUEST",
      title: "x".repeat(300),
    });
    const lines = ics.split("\r\n");

    expect(lines.every((line) => line.length <= 75)).toBe(true);
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${"x".repeat(300)}`);
  });
});
