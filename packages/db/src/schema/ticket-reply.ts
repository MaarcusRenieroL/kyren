import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";

/**
 * A saved answer an agent drops into a ticket reply. `{customer}`, `{agent}`
 * and `{ticket}` in the body are filled in when it is inserted.
 */
export const cannedReplies = pgTable(
  "cannedReply",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdByMemberId: uuid("createdByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("cannedReply_organization_idx").on(table.organizationId)],
);
