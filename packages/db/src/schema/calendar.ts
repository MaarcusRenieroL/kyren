import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";

/** A shared calendar event, visible to everyone who can open Calendar. */
export const calendarEvents = pgTable(
  "calendarEvent",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("createdByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),

    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    color: text("color").notNull().default("blue"),
    allDay: boolean("allDay").notNull().default(false),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt").notNull(),
    /** "daily", "weekly" or "monthly"; null for a one-off event. */
    repeat: text("repeat"),
    /** The last day an occurrence may start, inclusive; null repeats forever. */
    repeatUntil: date("repeatUntil", { mode: "string" }),
    /** The creator's IANA zone; a series repeats on its local clock. */
    timeZone: text("timeZone").notNull().default("UTC"),
    /** Starts (ISO instants) of occurrences taken out of the series. */
    skipped: text("skipped")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    index("calendar_event_range_idx").on(table.organizationId, table.startsAt),
    check(
      "calendarEvent_repeat_check",
      sql`${table.repeat} is null or ${table.repeat} in ('daily', 'weekly', 'monthly')`,
    ),
  ],
);

export type CalendarEvent = typeof calendarEvents.$inferSelect;
