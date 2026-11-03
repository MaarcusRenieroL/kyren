import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations, users } from "./auth";
import { tasks } from "./task";

/**
 * The timer a person has running right now. It lives on the server so a
 * refresh, another tab or another device sees the same clock. Stopping it
 * turns it into an ordinary time log on the task.
 */
export const runningTimers = pgTable(
  "runningTimer",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    taskId: uuid("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),

    startedAt: timestamp("startedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("running_timer_one_per_person").on(
      table.organizationId,
      table.userId,
    ),
  ],
);
