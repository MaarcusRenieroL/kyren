import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";

/** A reusable starting point: a task, optionally with the steps it always has. */
export const taskTemplates = pgTable(
  "taskTemplate",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** Also the default name of the task it creates. */
    name: text("name").notNull(),
    taskDescription: text("taskDescription"),
    priority: text("priority").notNull().default("medium"),
    estimatePoints: integer("estimatePoints"),
    /** Days after creation the task is due; empty for no due date. */
    dueInDays: integer("dueInDays"),
    /** Titles of the sub-tasks created with it, in order. */
    subtasks: jsonb("subtasks").$type<string[]>().notNull().default([]),

    createdByMemberId: uuid("createdByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("taskTemplate_organization_idx").on(table.organizationId)],
);
