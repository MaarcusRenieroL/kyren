import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";
import { docs } from "./doc";

/**
 * A saved state of a doc's content. One person's saves within a few minutes
 * of each other fold into the same version, which keeps their latest text.
 */
export const docVersions = pgTable(
  "docVersion",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    docId: uuid("docId")
      .notNull()
      .references(() => docs.id, { onDelete: "cascade" }),

    authorMemberId: uuid("authorMemberId").references(() => members.id, {
      onDelete: "set null",
    }),

    content: text("content").notNull(),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    index("doc_version_doc_updated_idx").on(table.docId, table.updatedAt),
  ],
);

export type DocVersion = typeof docVersions.$inferSelect;
