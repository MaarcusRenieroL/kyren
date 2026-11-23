import { createHmac, randomUUID } from "node:crypto";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { members, sessions, users } from "@zentro/db/schema";

import { appRouter } from "../../src/server/root";
import { createAuditContext, type AuditContext } from "../../src/server/audit";
import { createPermissionContext } from "../../src/server/permissions";
import { loadEnabledModules } from "../../src/server/modules";
import type { TRPCContext } from "../../src/types";
import type { TestOrg, TestUser } from "./world-types";

/** A real session for `user`, as the cookie header Better Auth reads. */
export async function createSessionHeaders(user: TestUser, org?: TestOrg) {
  const token = randomUUID().replace(/-/g, "");

  await db.insert(sessions).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 3_600_000),
    activeOrganizationId: org?.id ?? null,
  });

  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(token)
    .digest("base64");

  return new Headers({
    cookie: `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`,
    origin: "http://localhost:3000",
  });
}

export async function createOrgCaller(
  user: TestUser,
  org: TestOrg,
  options: {
    memberOrder?: "asc" | "desc";
    headers?: Record<string, string>;
    wrapAudit?: (audit: AuditContext) => AuditContext;
    sessionAgeMs?: number;
  } = {},
) {
  const rows = await db
    .select({ member: members, user: users })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, org.id));

  rows.sort((a, b) => {
    const diff = a.member.id.localeCompare(b.member.id);

    return options.memberOrder === "desc" ? -diff : diff;
  });

  const activeOrganization = {
    ...org,
    members: rows.map(({ member, user: memberUser }) => ({
      ...member,
      user: memberUser,
    })),
    invitations: [],
  };

  const headers = await createSessionHeaders(user, org);

  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers.set(name, value);
  }

  const audit = createAuditContext({
    organizationId: org.id,
    userId: user.id,
    headers,
  });

  return appRouter.createCaller({
    db,
    headers,
    permissions: createPermissionContext(db, org.id, user.id),
    audit: options.wrapAudit ? options.wrapAudit(audit) : audit,
    session: {
      session: {
        id: randomUUID(),
        token: randomUUID(),
        userId: user.id,
        activeOrganizationId: org.id,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(Date.now() - (options.sessionAgeMs ?? 0)),
        updatedAt: new Date(),
      },
      user,
    },
    user,
    activeOrganization,
    enabledModules: () => loadEnabledModules(db, org.id),
  } as unknown as TRPCContext);
}

/** A signed-in caller who has no active organization (a brand new user). */
export function createSessionCaller(
  user: TestUser,
  options: { sessionAgeMs?: number; ip?: string } = {},
) {
  return appRouter.createCaller({
    db,
    headers: new Headers(options.ip ? { "x-forwarded-for": options.ip } : {}),
    permissions: createPermissionContext(db, null, user.id),
    audit: createAuditContext({
      organizationId: null,
      userId: user.id,
    }),
    session: {
      session: {
        id: randomUUID(),
        token: randomUUID(),
        userId: user.id,
        activeOrganizationId: null,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(Date.now() - (options.sessionAgeMs ?? 0)),
        updatedAt: new Date(),
      },
      user,
    },
    user,
    activeOrganization: null,
    enabledModules: async () => new Set(),
  } as unknown as TRPCContext);
}

export function anonymousCaller() {
  return appRouter.createCaller({
    db,
    headers: new Headers(),
    permissions: createPermissionContext(db, null, null),
    audit: createAuditContext({ organizationId: null, userId: null }),
    session: null,
    user: null,
    activeOrganization: null,
    enabledModules: async () => new Set(),
  } as unknown as TRPCContext);
}
