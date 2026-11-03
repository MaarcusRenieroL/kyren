import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Work to do later and retry when it fails, such as an email that could not be
 * sent. Finished jobs are deleted; jobs that ran out of attempts stay as `dead`.
 */
export const jobs = pgTable(
  "job",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

    /** pending or dead. */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("maxAttempts").notNull().default(5),
    /** When it may run next. A running job holds this in the future as a lease. */
    runAt: timestamp("runAt").notNull().defaultNow(),
    lastError: text("lastError"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("job_due_idx").on(table.status, table.runAt)],
);
