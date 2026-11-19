import type { db as Database } from "@zentro/db";

import { loadEnabledModules } from "./modules";
import { organizationStatus } from "./platform-policy";

/**
 * Whether an organization's public ticket desk (intake forms, the customer
 * portal, inbound email and the help centre) is open. A suspended
 * organization, or one that turned Tickets off, takes nothing in and shows
 * nothing, exactly as if the link did not exist.
 */
export async function ticketsOpenToPublic(db: unknown, organizationId: string) {
  const handle = db as typeof Database;

  if ((await organizationStatus(handle, organizationId)).suspended)
    return false;

  return (await loadEnabledModules(handle, organizationId)).has("tickets");
}
