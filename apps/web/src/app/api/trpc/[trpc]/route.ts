import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import {
  appRouter,
  createAuditContext,
  createEnabledModulesLoader,
  createPermissionContext,
  reportError,
} from "@kyren/api/server";
import { auth } from "@kyren/auth";
import { db } from "@kyren/db";

const handler = (request: Request) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        void reportError("trpc", error.cause ?? error, { path });
      }
    },
    createContext: async () => {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session) {
        return {
          db,
          session: null,
          user: null,
          activeOrganization: null,
          enabledModules: createEnabledModulesLoader(db, null),
          permissions: createPermissionContext(db, null, null),
          audit: createAuditContext({
            organizationId: null,
            userId: null,
            headers: request.headers,
          }),
          headers: request.headers,
        };
      }

      // The active organization comes from the session, not from the host.
      // Every request needs the organization, not its member list.
      const activeOrganization = await auth.api.getFullOrganization({
        headers: request.headers,
        query: { membersLimit: 1 },
      });

      return {
        db,
        session,
        user: session.user,
        activeOrganization,
        enabledModules: createEnabledModulesLoader(
          db,
          activeOrganization?.id ?? null,
        ),
        permissions: createPermissionContext(
          db,
          activeOrganization?.id ?? null,
          session.user.id,
        ),
        audit: createAuditContext({
          organizationId: activeOrganization?.id ?? null,
          userId: session.user.id,
          headers: request.headers,
        }),
        headers: request.headers,
      };
    },
  });
};

export { handler as GET, handler as POST };
