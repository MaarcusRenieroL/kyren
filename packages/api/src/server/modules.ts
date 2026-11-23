import { eq } from "@kyren/db/drizzle";
import { organizationModules } from "@kyren/db/schema";
import type { db as database } from "@kyren/db";
import { resolveEnabled, type ModuleId } from "@kyren/modules";

type Database = typeof database;

export async function loadEnabledModules(
  db: Database,
  organizationId: string,
): Promise<Set<ModuleId>> {
  const rows = await db
    .select({
      moduleId: organizationModules.moduleId,
      enabled: organizationModules.enabled,
    })
    .from(organizationModules)
    .where(eq(organizationModules.organizationId, organizationId));

  return resolveEnabled(rows);
}

/** Memoizes the lookup so a request queries the table at most once. */
export function createEnabledModulesLoader(
  db: Database,
  organizationId: string | null,
) {
  let pending: Promise<ReadonlySet<ModuleId>> | undefined;

  return () => {
    if (!organizationId) {
      return Promise.resolve<ReadonlySet<ModuleId>>(new Set());
    }

    pending ??= loadEnabledModules(db, organizationId);

    return pending;
  };
}
