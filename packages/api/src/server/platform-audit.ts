import type { db as Database } from "@kyren/db";
import { platformAuditEvents } from "@kyren/db/schema";

import { clientIp } from "./client-ip";

export type PlatformAuditInput = {
  /** For example `tenant.suspended`. */
  action: string;
  organizationId?: string | null;
  targetType: string;
  targetId?: string | null;
  label?: string;
  detail?: Record<string, unknown>;
};

/** The "actor" of changes the platform makes by itself, such as a scheduled purge. */
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/** What a platform call carries so it can log itself and be checked for having done so. */
export type PlatformAuditContext = {
  db: typeof Database;
  user: { id: string; email: string };
  headers: Headers | null;
  platformAudit: { recorded: number };
};

/** Writes one line of the operator trail. Every platform change and every look at a tenant goes through here. */
export async function recordPlatformAudit(
  ctx: PlatformAuditContext,
  event: PlatformAuditInput,
) {
  ctx.platformAudit.recorded += 1;
  await ctx.db.insert(platformAuditEvents).values({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: event.action,
    organizationId: event.organizationId ?? null,
    targetType: event.targetType,
    targetId: event.targetId ?? null,
    label: event.label ?? "",
    detail: event.detail ?? {},
    ip: ctx.headers ? clientIp(ctx.headers) : null,
  });
}
