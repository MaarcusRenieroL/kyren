import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

import { members, organizations } from "./auth";

/** A folder in the Files library; one level deep, names unique per organization. */
export const fileFolders = pgTable(
  "fileFolder",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdByMemberId: uuid("createdByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("file_folder_org_name_idx").on(
      table.organizationId,
      sql`lower(${table.name})`,
    ),
  ],
);

/**
 * A stored file. The bytes live in the configured storage (a local folder
 * in development, an S3-compatible bucket in production) under `storageKey`.
 */
export const files = pgTable(
  "file",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    uploadedByMemberId: uuid("uploadedByMemberId").references(
      () => members.id,
      { onDelete: "set null" },
    ),

    name: text("name").notNull(),
    mimeType: text("mimeType").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    /** Image width and height, when known, for layout before it loads. */
    width: integer("width"),
    height: integer("height"),
    storageKey: text("storageKey").notNull(),
    /**
     * "library" for uploads to the Files library, which everyone with Files
     * access may open; "chat" for uploads from a message, which stay with the
     * conversation (and with the uploader until it is sent).
     */
    source: text("source").notNull().default("chat"),
    /** The library folder it sits in; null is the top of the library. */
    folderId: uuid("folderId").references(() => fileFolders.id, {
      onDelete: "set null",
    }),

    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("file_organization_idx").on(table.organizationId),
    index("file_folder_idx").on(table.folderId),
    // A stored object belongs to one file record, so a known key cannot be
    // registered a second time to gain access to it.
    uniqueIndex("file_storage_key_idx").on(table.storageKey),
  ],
);

/** Files attached to a chat message, in the order they were added. */
export const chatAttachments = pgTable(
  "chatAttachment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("messageId").notNull(),
    fileId: uuid("fileId")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    index("chat_attachment_message_idx").on(table.messageId),
    index("chat_attachment_file_idx").on(table.fileId),
  ],
);

export type StoredFile = typeof files.$inferSelect;
