import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { workspaceAccessBlock } from "@kyren/api/server";
import { auth } from "@kyren/auth";
import { db } from "@kyren/db";

import { AccessBlocked } from "~/src/components/workspace/access-blocked";
import { paths } from "~/src/lib/paths";

export const metadata: Metadata = { title: "Access paused" };

/**
 * Where the workspace sends someone whose organization is suspended or whose
 * network the organization does not allow. The reason is worked out here,
 * not read from the address, so it cannot be faked.
 */
export default async function AccessBlockedPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) redirect(paths.auth.signIn());

  const organizationId = session.session.activeOrganizationId;
  const block = organizationId
    ? await workspaceAccessBlock(db, organizationId, requestHeaders)
    : null;

  if (!block) redirect(paths.dashboard());

  // Other organizations the person belongs to stay reachable from here,
  // when they are not paused or closed to this network themselves.
  const organizations = await auth.api.listOrganizations({
    headers: requestHeaders,
  });
  const elsewhere = [];

  for (const organization of organizations) {
    if (organization.id === organizationId) continue;

    if (!(await workspaceAccessBlock(db, organization.id, requestHeaders))) {
      elsewhere.push({ id: organization.id, name: organization.name });
    }
  }

  return (
    <AccessBlocked
      reason={block.reason}
      message={block.message}
      elsewhere={elsewhere}
    />
  );
}
