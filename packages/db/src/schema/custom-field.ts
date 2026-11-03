import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { organizations } from "./auth";
import { tasks } from "./task";

/** A field an organization adds to every task, such as "Client" or "Budget". */
export const customFields = pgTable(
  "customField",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: text("name").notNull(),

    /** text, number, date or select. */
    type: text("type").notNull(),

    /** The choices of a select field. */
    options: jsonb("options").$type<string[]>().notNull().default([]),

    position: integer("position").notNull().default(0),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("custom_field_org_name_unique").on(
      table.organizationId,
      sql`lower(${table.name})`,
    ),
  ],
);

/** The value one task holds for one field, stored as text and typed by the field. */
export const customFieldValues = pgTable(
  "customFieldValue",
  {
    taskId: uuid("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),

    fieldId: uuid("fieldId")
      .notNull()
      .references(() => customFields.id, { onDelete: "cascade" }),

    value: text("value").notNull(),

    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.fieldId] }),
    index("custom_field_value_field_idx").on(table.fieldId),
  ],
);
