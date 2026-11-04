import { eq } from "drizzle-orm";

import { db } from "../client";
import { users } from "../schema";

// Usage: pnpm --filter @zentro/db platform-admin <grant|revoke> <email>
// Platform access is never granted through the app; an operator runs this.
const [action, email] = process.argv.slice(2);

if ((action !== "grant" && action !== "revoke") || !email) {
  console.error("Usage: platform-admin <grant|revoke> <email>");
  process.exit(1);
}

const [user] = await db
  .select({ id: users.id, twoFactorEnabled: users.twoFactorEnabled })
  .from(users)
  .where(eq(users.email, email.toLowerCase()));

if (!user) {
  console.error(`No user with the email ${email}.`);
  process.exit(1);
}

if (action === "grant" && !user.twoFactorEnabled) {
  console.error(
    "Turn on two-factor for this account first (Settings, Security), then run this again.",
  );
  process.exit(1);
}

await db
  .update(users)
  .set({ role: action === "grant" ? "platform_admin" : "member" })
  .where(eq(users.id, user.id));

console.log(
  action === "grant"
    ? `${email} is now a platform admin.`
    : `${email} is no longer a platform admin.`,
);
process.exit(0);
