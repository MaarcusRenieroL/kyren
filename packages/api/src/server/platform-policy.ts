import { eq } from "@kyren/db/drizzle";
import type { db as Database } from "@kyren/db";
import {
  organizations,
  platformIpAllowlist,
  platformSettings,
} from "@kyren/db/schema";

import { ipMatches } from "./ip-policy";

type Db = typeof Database;

const ttlMs = 15_000;

/** One cached value per server; changes clear it on the server that made them. */
function remembered<T>(load: (db: Db) => Promise<T>) {
  let hit: { value: T; until: number } | null = null;

  return {
    async get(db: Db) {
      if (hit && hit.until > Date.now()) return hit.value;

      const value = await load(db);

      hit = { value, until: Date.now() + ttlMs };

      return value;
    },
    forget() {
      hit = null;
    },
  };
}

export type MaintenanceState = { enabled: boolean; message: string };

const maintenance = remembered<MaintenanceState>(async (db) => {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, "maintenance"))
    .limit(1);

  return {
    enabled: row?.value.enabled === true,
    message: typeof row?.value.message === "string" ? row.value.message : "",
  };
});

/** Whether the platform is in maintenance mode, which makes it read-only. */
export const maintenanceState = (db: Db) => maintenance.get(db);
export const forgetMaintenance = () => maintenance.forget();

const platformRanges = remembered<string[]>(async (db) =>
  (
    await db
      .select({ cidr: platformIpAllowlist.cidr })
      .from(platformIpAllowlist)
  ).map((row) => row.cidr),
);

/** Whether `ip` may open the platform console. With no ranges set, any address may. */
export async function platformIpAllowed(db: Db, ip: string | null) {
  const ranges = await platformRanges.get(db);

  if (!ranges.length) return true;

  return ip !== null && ranges.some((range) => ipMatches(ip, range));
}

export const forgetPlatformIpPolicy = () => platformRanges.forget();

export type OrganizationStatus = {
  suspended: boolean;
  reason: string | null;
};

const statuses = new Map<
  string,
  { value: OrganizationStatus; until: number }
>();

/** Whether a platform operator has suspended the organization. */
export async function organizationStatus(
  db: Db,
  organizationId: string,
): Promise<OrganizationStatus> {
  const hit = statuses.get(organizationId);

  if (hit && hit.until > Date.now()) return hit.value;

  const [row] = await db
    .select({
      suspendedAt: organizations.suspendedAt,
      reason: organizations.suspendedReason,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const value = {
    suspended: Boolean(row?.suspendedAt),
    reason: row?.reason ?? null,
  };

  statuses.set(organizationId, { value, until: Date.now() + ttlMs });

  return value;
}

export function forgetOrganizationStatus(organizationId: string) {
  statuses.delete(organizationId);
}

/** The ceilings a platform operator set for an organization (none means the default). */
export async function organizationLimits(db: Db, organizationId: string) {
  const [row] = await db
    .select({ limits: organizations.limits })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return row?.limits ?? {};
}

/**
 * Whether a platform operator switched a feature on for the organization.
 * Flags default to off, so a feature gated this way is invisible until enabled.
 */
export async function featureEnabled(
  db: Db,
  organizationId: string,
  flag: string,
) {
  const [row] = await db
    .select({ flags: organizations.featureFlags })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return row?.flags[flag] === true;
}
