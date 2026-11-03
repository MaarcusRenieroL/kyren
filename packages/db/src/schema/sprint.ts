import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { organizations } from "./auth";
import { projects } from "./project";

/** A fixed stretch of time in which a project's team works through chosen tasks. */
export const sprints = pgTable(
  "sprint",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    projectId: uuid("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    goal: text("goal"),
    startsOn: date("startsOn").notNull(),
    endsOn: date("endsOn").notNull(),

    /** planned, active or completed. */
    status: text("status").notNull().default("planned"),

    /** Kept when the sprint closes, so velocity survives later task edits. */
    committedPoints: integer("committedPoints"),
    completedPoints: integer("completedPoints"),
    completedAt: timestamp("completedAt"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sprint_one_active_per_project")
      .on(table.projectId)
      .where(sql`${table.status} = 'active'`),
    index("sprint_project_idx").on(table.projectId, table.startsOn),
  ],
);
