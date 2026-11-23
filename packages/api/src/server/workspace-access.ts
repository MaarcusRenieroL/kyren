import type { db as Database } from "@kyren/db";

import { clientIp } from "./client-ip";
import { ipAllowed } from "./ip-policy";
import { organizationStatus } from "./platform-policy";

export type WorkspaceBlock =
  | { reason: "suspended"; message: string }
  | { reason: "network"; message: string };

/**
 * Why a request may not use an organization at all, or null when it may.
 * The API and the server-rendered pages both ask here, so a suspended
 * organization or a blocked network sees nothing either way.
 */
export async function workspaceAccessBlock(
  db: typeof Database,
  organizationId: string,
  headers: Headers | null | undefined,
): Promise<WorkspaceBlock | null> {
  const status = await organizationStatus(db, organizationId);

  if (status.suspended) {
    return {
      reason: "suspended",
      message: status.reason
        ? `This organization is suspended: ${status.reason}`
        : "This organization is suspended. Contact support.",
    };
  }

  if (!(await ipAllowed(db, organizationId, clientIp(headers)))) {
    return {
      reason: "network",
      message: "Your network is not allowed to use this organization.",
    };
  }

  return null;
}
