import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";
import { projects } from "./project";

/** A task that comes back on a schedule: each time it falls due, a fresh copy is created. */
export const taskRecurrences = pgTable(
  "taskRecurrence",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description"),
    priority: text("priority").notNull().default("medium"),
    assignedToMemberId: uuid("assignedToMemberId").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    /** Days after creation the new task is due; empty for no due date. */
    dueInDays: integer("dueInDays"),

    /** daily, weekly or monthly. */
    cadence: text("cadence").notNull(),
    nextRunAt: timestamp("nextRunAt").notNull(),
    lastRunAt: timestamp("lastRunAt"),
    enabled: boolean("enabled").notNull().default(true),

    createdByMemberId: uuid("createdByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("taskRecurrence_due_idx").on(table.enabled, table.nextRunAt),
    index("taskRecurrence_project_idx").on(table.projectId),
  ],
);
