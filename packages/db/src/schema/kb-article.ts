import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";

/**
 * A help article. Plain text only, so it can be shown anywhere without
 * sanitizing. `public` ones appear on the organization's help centre once
 * published; `internal` ones are for the team, e.g. to paste into a reply.
 */
export const kbArticles = pgTable(
  "kbArticle",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull().default(""),

    status: text("status").notNull().default("draft"),
    audience: text("audience").notNull().default("internal"),

    updatedByMemberId: uuid("updatedByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("kbArticle_organization_slug_unique").on(
      table.organizationId,
      table.slug,
    ),
    index("kbArticle_organization_idx").on(
      table.organizationId,
      table.status,
      table.audience,
    ),
  ],
);
