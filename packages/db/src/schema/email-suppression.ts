import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Addresses Kyren no longer emails: they bounced hard or reported a message
 * as spam. Sending to them again hurts deliverability for everyone.
 */
export const emailSuppressions = pgTable("emailSuppression", {
  /** Lower-case address. */
  email: text("email").primaryKey(),
  /** "bounced" or "complained". */
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
