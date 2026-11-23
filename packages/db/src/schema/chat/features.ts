import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { members, organizations } from "../auth";
import { chatChannels, chatMessages } from "./core";

/** A message saved for later, optionally with a reminder. */
export const chatSaved = pgTable(
  "chatSaved",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("memberId")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    messageId: uuid("messageId")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    remindAt: timestamp("remindAt"),
    remindedAt: timestamp("remindedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_saved_unique_idx").on(table.memberId, table.messageId),
    index("chat_saved_remind_idx").on(table.remindAt),
  ],
);

/** An unsent message, per person and composer (`scope` is channel[:thread]). */
export const chatDrafts = pgTable(
  "chatDraft",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("memberId")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    channelId: uuid("channelId")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    body: text("body").notNull(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_draft_unique_idx").on(table.memberId, table.scope),
  ],
);

/** A message waiting for its send time. */
export const chatScheduled = pgTable(
  "chatScheduled",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("memberId")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    channelId: uuid("channelId")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    parentId: uuid("parentId"),
    body: text("body").notNull(),
    sendAt: timestamp("sendAt").notNull(),
    sentAt: timestamp("sentAt"),
    canceledAt: timestamp("canceledAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("chat_scheduled_due_idx").on(table.sendAt)],
);

/** Whether someone follows a thread, and how far they have read it. */
export const chatThreadFollows = pgTable(
  "chatThreadFollow",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("memberId")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    parentId: uuid("parentId")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    following: boolean("following").notNull().default(true),
    lastReadAt: timestamp("lastReadAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_thread_follow_unique_idx").on(
      table.memberId,
      table.parentId,
    ),
  ],
);

export const chatPolls = pgTable(
  "chatPoll",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    multiple: boolean("multiple").notNull().default(false),
    closedAt: timestamp("closedAt"),
  },
  (table) => [uniqueIndex("chat_poll_message_idx").on(table.messageId)],
);

export const chatPollVotes = pgTable(
  "chatPollVote",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pollId: uuid("pollId")
      .notNull()
      .references(() => chatPolls.id, { onDelete: "cascade" }),
    memberId: uuid("memberId")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    optionIndex: integer("optionIndex").notNull(),
  },
  (table) => [
    uniqueIndex("chat_poll_vote_unique_idx").on(
      table.pollId,
      table.memberId,
      table.optionIndex,
    ),
  ],
);

/** What an external link looks like, fetched once per organization. */
export const chatLinkPreviews = pgTable(
  "chatLinkPreview",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    description: text("description"),
    image: text("image"),
    siteName: text("siteName"),
    failed: boolean("failed").notNull().default(false),
    fetchedAt: timestamp("fetchedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_link_preview_unique_idx").on(
      table.organizationId,
      table.url,
    ),
  ],
);

/** A person's custom status and do-not-disturb window. */
export const chatStatuses = pgTable(
  "chatStatus",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("memberId")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    emoji: text("emoji"),
    text: text("text"),
    expiresAt: timestamp("expiresAt"),
    dndUntil: timestamp("dndUntil"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("chat_status_member_idx").on(table.memberId)],
);

/** A link pinned to the top of a channel: an address, or a task/doc/project. */
export const chatBookmarks = pgTable(
  "chatBookmark",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channelId")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    createdByMemberId: uuid("createdByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("chat_bookmark_channel_idx").on(table.channelId)],
);

/** A custom emoji, written `:name:`, backed by an uploaded image. */
export const chatEmojis = pgTable(
  "chatEmoji",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    fileId: uuid("fileId").notNull(),
    createdByMemberId: uuid("createdByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_emoji_unique_idx").on(table.organizationId, table.name),
  ],
);

/**
 * A rule sending task events into a channel (the activity feed). Events:
 * "created", "done", "assigned", "overdue".
 */
export const chatFeedRules = pgTable(
  "chatFeedRule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channelId")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    events: jsonb("events").$type<string[]>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (table) => [uniqueIndex("chat_feed_rule_channel_idx").on(table.channelId)],
);

export type ChatSaved = typeof chatSaved.$inferSelect;
export type ChatPoll = typeof chatPolls.$inferSelect;
