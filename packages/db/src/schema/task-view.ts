import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { organizations, users } from "./auth";

/** The filters, grouping and layout of the task list, as a person saved them. */
export type TaskViewConfig = {
  search: string;
  status: string;
  priority: string;
  assignee: string;
  team: string;
  group: string;
  sort: string;
  view: string;
};

export const taskViews = pgTable(
  "taskView",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    ownerUserId: uuid("ownerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),

    /** Visible to everyone in the organization, not just the owner. */
    shared: boolean("shared").notNull().default(false),

    config: jsonb("config").$type<TaskViewConfig>().notNull(),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("task_view_owner_name_unique").on(
      table.organizationId,
      table.ownerUserId,
      sql`lower(${table.name})`,
    ),
    index("task_view_org_idx").on(table.organizationId),
  ],
);
