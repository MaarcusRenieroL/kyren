import { randomUUID } from "node:crypto";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { members, organizations, users } from "@zentro/db/schema";

import type { TRPCContext } from "../types";
import type { ApiKeyOwner } from "./api-keys";
import { createAuditContext } from "./audit";
import { loadEnabledModules } from "./modules";
import { createPermissionContext } from "./permissions";
import { appRouter } from "./root";

/**
 * A caller for a public-API request. It acts as the person who made the key,
 * in the organization the key belongs to, so every permission and module check
 * applies exactly as it does in the app.
 */
export async function apiKeyCaller(owner: ApiKeyOwner, headers: Headers) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, owner.organizationId));

  if (!org) return null;

  const rows = await db
    .select({ member: members, user: users })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, org.id));

  const activeOrganization = {
    ...org,
    members: rows.map(({ member, user }) => ({ ...member, user })),
    invitations: [],
  };

  return appRouter.createCaller({
    db,
    headers,
    permissions: createPermissionContext(db, org.id, owner.user.id),
    audit: createAuditContext({
      organizationId: org.id,
      userId: owner.user.id,
      headers,
    }),
    session: {
      session: {
        id: randomUUID(),
        token: randomUUID(),
        userId: owner.user.id,
        activeOrganizationId: org.id,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: owner.user,
    },
    user: owner.user,
    activeOrganization,
    enabledModules: () => loadEnabledModules(db, org.id),
  } as unknown as TRPCContext);
}
