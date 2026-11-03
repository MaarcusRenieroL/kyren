import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";

/** How long an organization keeps one kind of data before it is deleted. */
export const retentionPolicies = pgTable(
  "retentionPolicy",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** chat_messages or closed_tickets. */
    dataType: text("dataType").notNull(),
    days: integer("days").notNull(),

    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("retentionPolicy_organization_type_unique").on(
      table.organizationId,
      table.dataType,
    ),
    index("retentionPolicy_organization_idx").on(table.organizationId),
  ],
);

/** While a row exists, nothing of the organization is purged and nobody is erased. */
export const legalHolds = pgTable("legalHold", {
  organizationId: uuid("organizationId")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),

  reason: text("reason").notNull(),
  setByMemberId: uuid("setByMemberId").references(() => members.id, {
    onDelete: "set null",
  }),
  setAt: timestamp("setAt").notNull().defaultNow(),
});
