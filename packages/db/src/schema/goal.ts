import {
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";
import { tasks } from "./task";

/** A goal for a period, measured by its key results. */
export const objectives = pgTable(
  "objective",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    /** A label such as "Q4 2026"; free text. */
    period: text("period"),
    status: text("status").notNull().default("active"),
    ownerMemberId: uuid("ownerMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("objective_organization_idx").on(table.organizationId)],
);

/** How an objective is measured: a number moving to a target, or tasks done. */
export const keyResults = pgTable(
  "keyResult",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    objectiveId: uuid("objectiveId")
      .notNull()
      .references(() => objectives.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** "metric" or "tasks". */
    kind: text("kind").notNull().default("metric"),
    startValue: doublePrecision("startValue").notNull().default(0),
    targetValue: doublePrecision("targetValue").notNull().default(100),
    currentValue: doublePrecision("currentValue").notNull().default(0),
    unit: text("unit"),
    ownerMemberId: uuid("ownerMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("keyResult_objective_idx").on(table.objectiveId)],
);

export const keyResultTasks = pgTable(
  "keyResultTask",
  {
    keyResultId: uuid("keyResultId")
      .notNull()
      .references(() => keyResults.id, { onDelete: "cascade" }),
    taskId: uuid("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.keyResultId, table.taskId] })],
);
