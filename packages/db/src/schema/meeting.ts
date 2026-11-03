import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations, users } from "./auth";

/**
 * A meeting people are invited to. Unlike a shared calendar event, only the
 * organizer and the invitees can see it, its video room and its notes.
 */
export const meetings = pgTable(
  "meeting",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    organizerUserId: uuid("organizerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    agenda: text("agenda"),
    startsAt: timestamp("startsAt").notNull(),
    durationMinutes: integer("durationMinutes").notNull(),

    /** Unguessable part of the video room name. */
    roomSlug: text("roomSlug").notNull(),

    status: text("status").notNull().default("scheduled"),
    notes: text("notes"),
    summary: text("summary"),

    /** Set once the starting-soon email went out. */
    reminderSentAt: timestamp("reminderSentAt"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("meeting_org_start_idx").on(table.organizationId, table.startsAt),
  ],
);

export const meetingAttendees = pgTable(
  "meetingAttendee",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    meetingId: uuid("meetingId")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),

    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** invited, yes, no or maybe. */
    response: text("response").notNull().default("invited"),
  },
  (table) => [
    uniqueIndex("meeting_attendee_unique").on(table.meetingId, table.userId),
    index("meeting_attendee_user_idx").on(table.userId),
  ],
);
