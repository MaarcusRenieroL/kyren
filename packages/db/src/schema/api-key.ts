import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations, users } from "./auth";

/**
 * A key for the read-only public API. The key itself is shown once; only its
 * SHA-256 hash is stored. Requests made with it act as the person who made it,
 * so it can never see more than that person can.
 */
export const apiKeys = pgTable(
  "apiKey",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    createdByUserId: uuid("createdByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),

    /** The first characters of the key, so people can tell keys apart. */
    prefix: text("prefix").notNull(),

    keyHash: text("keyHash").notNull(),

    lastUsedAt: timestamp("lastUsedAt"),

    expiresAt: timestamp("expiresAt"),

    revokedAt: timestamp("revokedAt"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_key_hash_idx").on(table.keyHash),
    index("api_key_org_idx").on(table.organizationId),
  ],
);

export type ApiKey = typeof apiKeys.$inferSelect;
