import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** A setting that applies to the whole platform, such as maintenance mode. */
export const platformSettings = pgTable("platformSetting", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

/** A network range allowed to open the platform console. Empty means any network. */
export const platformIpAllowlist = pgTable("platformIpAllowlist", {
  id: uuid("id").defaultRandom().primaryKey(),
  cidr: text("cidr").notNull(),
  label: text("label").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/** A notice shown to every signed-in user while it is live. */
export const platformAnnouncements = pgTable("platformAnnouncement", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  /** info, warning or critical. */
  severity: text("severity").notNull().default("info"),
  startsAt: timestamp("startsAt").notNull().defaultNow(),
  endsAt: timestamp("endsAt"),
  withdrawnAt: timestamp("withdrawnAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/**
 * What platform operators did. Kept apart from the organizations' own logs and
 * with no foreign keys, so it outlives the tenants and operators it names.
 */
export const platformAuditEvents = pgTable(
  "platformAuditEvent",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actorId").notNull(),
    actorEmail: text("actorEmail").notNull(),
    action: text("action").notNull(),
    organizationId: uuid("organizationId"),
    targetType: text("targetType").notNull(),
    targetId: text("targetId"),
    label: text("label").notNull().default(""),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ip: text("ip"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("platformAudit_created_idx").on(table.createdAt),
    index("platformAudit_org_idx").on(table.organizationId),
  ],
);
