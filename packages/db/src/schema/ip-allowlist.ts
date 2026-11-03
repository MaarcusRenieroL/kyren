import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "./auth";

/** A network range (an address or CIDR block) allowed to use an organization. */
export const ipAllowlist = pgTable(
  "ipAllowlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    cidr: text("cidr").notNull(),
    label: text("label").notNull().default(""),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("ipAllowlist_organization_idx").on(table.organizationId)],
);
