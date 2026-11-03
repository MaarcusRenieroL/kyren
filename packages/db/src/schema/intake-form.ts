import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

import { organizations } from "./auth";

export type IntakeField = {
  id: string;
  label: string;
  /** name and email fill the requester; the rest become lines of the ticket. */
  type: "name" | "email" | "text" | "longtext" | "choice";
  required: boolean;
  options?: string[];
};

/** A public form whose submissions open tickets. */
export const intakeForms = pgTable(
  "intakeForm",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    fields: jsonb("fields").$type<IntakeField[]>().notNull(),
    enabled: boolean("enabled").notNull().default(true),

    /** The secret in the form's public link. */
    token: text("token")
      .notNull()
      .unique()
      .default(
        sql`replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)`,
      ),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("intakeForm_organization_idx").on(table.organizationId)],
);
