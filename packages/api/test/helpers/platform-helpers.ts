import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { platformAuditEvents, users } from "@kyren/db/schema";
import { World } from "./world";

export async function createOperator(world: World) {
  const created = await world.user("Operator");

  await db
    .update(users)
    .set({ role: "platform_admin", twoFactorEnabled: true })
    .where(eq(users.id, created.id));

  const [row] = await db.select().from(users).where(eq(users.id, created.id));

  return row!;
}

export async function auditActions(organizationId: string) {
  const rows = await db
    .select({ action: platformAuditEvents.action })
    .from(platformAuditEvents)
    .where(eq(platformAuditEvents.organizationId, organizationId));

  return rows.map((row) => row.action);
}
