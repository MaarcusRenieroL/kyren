import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";

import { organizations, users } from "./auth";

/** Where an organization wants its events sent. */
export const webhookEndpoints = pgTable(
  "webhookEndpoint",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    createdByUserId: uuid("createdByUserId").references(() => users.id, {
      onDelete: "set null",
    }),

    url: text("url").notNull(),

    /** Used to sign each delivery; shown once when the endpoint is made. */
    secret: text("secret").notNull(),

    /** Event keys such as "task.created", or "*" for everything. */
    events: jsonb("events").$type<string[]>().notNull().default(["*"]),

    enabled: boolean("enabled").notNull().default(true),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("webhook_endpoint_org_idx").on(table.organizationId)],
);

/** One event on its way to one endpoint, with its retry state. */
export const webhookDeliveries = pgTable(
  "webhookDelivery",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    endpointId: uuid("endpointId")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    event: text("event").notNull(),

    payload: jsonb("payload").notNull(),

    /** pending, delivered or failed (out of attempts). */
    status: text("status").notNull().default("pending"),

    attempts: integer("attempts").notNull().default(0),

    nextAttemptAt: timestamp("nextAttemptAt").notNull().defaultNow(),

    responseStatus: integer("responseStatus"),

    lastError: text("lastError"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),

    deliveredAt: timestamp("deliveredAt"),
  },
  (table) => [
    index("webhook_delivery_due_idx").on(table.status, table.nextAttemptAt),
    index("webhook_delivery_endpoint_idx").on(
      table.endpointId,
      table.createdAt,
    ),
  ],
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
