import {
  boolean,
  check,
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
import { tasks } from "./task";

/** A support request, numbered per organization (SUP-1, SUP-2, …). */
export const tickets = pgTable(
  "ticket",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),

    subject: text("subject").notNull(),
    description: text("description").notNull().default(""),
    requesterName: text("requesterName").notNull(),
    requesterEmail: text("requesterEmail"),

    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("normal"),
    category: text("category"),

    /** The secret in the requester's private link to follow and answer this ticket. */
    portalToken: text("portalToken")
      .notNull()
      .unique()
      .default(
        sql`replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')`,
      ),

    assigneeMemberId: uuid("assigneeMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    createdByMemberId: uuid("createdByMemberId").references(() => members.id, {
      onDelete: "set null",
    }),
    linkedTaskId: uuid("linkedTaskId").references(() => tasks.id, {
      onDelete: "set null",
    }),

    /** When a team member first answered the requester; stops the response clock. */
    firstRespondedAt: timestamp("firstRespondedAt"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ticket_organization_number_unique").on(
      table.organizationId,
      table.number,
    ),
    index("ticket_queue_idx").on(table.organizationId, table.status),
    index("ticket_assignee_idx").on(table.assigneeMemberId),
  ],
);

/** One entry in a ticket's thread: a reply to the requester or an internal note. */
export const ticketMessages = pgTable(
  "ticketMessage",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    ticketId: uuid("ticketId")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorMemberId: uuid("authorMemberId").references(() => members.id, {
      onDelete: "set null",
    }),

    /** `reply` goes to the requester, `note` stays inside the team. */
    kind: text("kind").notNull().default("reply"),
    body: text("body").notNull(),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("ticket_message_ticket_idx").on(table.ticketId)],
);

export type Ticket = typeof tickets.$inferSelect;
export type TicketMessage = typeof ticketMessages.$inferSelect;

/** How fast an organization promises to answer and resolve tickets of a priority. */
export const ticketSlaPolicies = pgTable(
  "ticketSlaPolicy",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    priority: text("priority").notNull(),

    /** Null means no target for that clock. */
    firstResponseMinutes: integer("firstResponseMinutes"),
    resolutionMinutes: integer("resolutionMinutes"),

    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ticket_sla_org_priority_unique").on(
      table.organizationId,
      table.priority,
    ),
  ],
);

/**
 * The address an organization receives support email on. The token is the
 * secret part of the address; rotating it retires the old one at once.
 */
export const ticketInboxes = pgTable("ticketInbox", {
  organizationId: uuid("organizationId")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/** Mail already handled, so a provider that delivers twice opens one ticket. */
export const ticketInbound = pgTable(
  "ticketInbound",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    messageId: text("messageId").notNull(),
    ticketId: uuid("ticketId")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ticket_inbound_message_unique").on(
      table.organizationId,
      table.messageId,
    ),
  ],
);

/**
 * Who new tickets from the public desk (email and forms) go to: the next
 * person in `memberIds` after `lastMemberId`, skipping anyone who is away.
 */
export const ticketAssignmentRules = pgTable(
  "ticketAssignmentRule",
  {
    organizationId: uuid("organizationId")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    memberIds: uuid("memberIds")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    lastMemberId: uuid("lastMemberId"),
    /** "round_robin" takes turns; "least_open" picks whoever has fewest open tickets. */
    mode: text("mode").notNull().default("round_robin"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    check(
      "ticketAssignmentRule_mode_check",
      sql`${table.mode} in ('round_robin', 'least_open')`,
    ),
  ],
);
