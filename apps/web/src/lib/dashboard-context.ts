import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@kyren/auth";
import {
  loadEnabledModules,
  loadPermissionSnapshot,
  workspaceAccessBlock,
} from "@kyren/api/server";
import { db } from "@kyren/db";
import { and, eq, isNull } from "@kyren/db/drizzle";
import {
  organizations as organizationsTable,
  projects,
} from "@kyren/db/schema";
import type { ModuleId } from "@kyren/modules";
import {
  can as engineCan,
  getCatalogKeys,
  reachablePermissions,
  type PermissionSnapshot,
  type ResourceContext,
} from "@kyren/permissions";

import { paths } from "~/src/lib/paths";

const defaultRole = "member";

/** Booleans the settings screens read; each one is a permission check. */
function toPermissionFlags(snapshot: PermissionSnapshot) {
  const has = (key: string) => engineCan(snapshot, key);

  return {
    canUpdateOrganization: has("org.settings.update"),
    canDeleteOrganization: has("org.delete"),
    canInviteMembers: has("members.invite"),
    canRemoveMembers: has("members.remove"),
    canUpdateMemberRoles: has("members.role.update"),
    canCreateProjects: has("projects.create"),
    canUpdateProjects: has("projects.update"),
    canArchiveProjects: has("projects.archive"),
    canDeleteProjects: has("projects.delete"),
    canCreateDocs: has("docs.create"),
    canUpdateDocs: has("docs.update_any"),
    canDeleteDocs: has("docs.trash_any"),
    canRestoreDocs: has("docs.restore"),
    canCommentOnDocs: has("docs.comment"),
    canCreateTeams: has("teams.create"),
    canUpdateTeams: has("teams.update"),
    canDeleteTeams: has("teams.delete"),
    canManageTeamMembers: has("teams.members.manage"),
  };
}

export async function getAuthorizedDashboardContext(permission: string) {
  const context = await getDashboardContext();

  return {
    ...context,
    authorization: {
      // Reachable, not just held organization-wide: a role on one project or
      // team is enough to open the area it covers.
      isAllowed: context.reachable[permission] ?? false,
      permission,
    },
  };
}

export const getDashboardContext = cache(async () => {
  const requestHeaders = await headers();

  // Both calls read the same headers and neither needs the other's result.
  // Start them together; a signed-out request redirects after the session
  // lookup, so swallow an organization lookup that fails on the way out.
  const organizationsPromise = auth.api.listOrganizations({
    headers: requestHeaders,
  });
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.user) {
    void organizationsPromise.catch(() => []);
    redirect(paths.auth.signIn());
  }

  if (!session.user.emailVerified) {
    void organizationsPromise.catch(() => []);
    redirect(paths.auth.verifyEmail(session.user.email));
  }

  const sessionWithUser = {
    ...session,
    user: session.user,
  };
  const organizations = await organizationsPromise;

  // The organization is the one active in the session. A session without one
  // (for example one created before the user joined an organization) falls
  // back to the user's first organization, which is then made active.
  let organization = organizations.find(
    (item) => item.id === sessionWithUser.session.activeOrganizationId,
  );

  if (!organization) {
    const fallbackOrganization = organizations[0];

    if (!fallbackOrganization) {
      redirect(paths.auth.createOrganization());
    }

    await auth.api.setActiveOrganization({
      headers: requestHeaders,
      body: { organizationId: fallbackOrganization.id },
    });

    organization = fallbackOrganization;
  }

  // Everything below depends only on the organization and the viewer, not on
  // each other. Run them as one batch so a remote database's round trips stop
  // adding up on every page render.
  const needsTwoFactor = !sessionWithUser.user.twoFactorEnabled;
  const [policyRows, accessBlocked, snapshot, enabledModules, projectList] =
    await Promise.all([
      needsTwoFactor
        ? db
            .select({ required: organizationsTable.requireTwoFactor })
            .from(organizationsTable)
            .where(eq(organizationsTable.id, organization.id))
            .limit(1)
        : Promise.resolve([] as { required: boolean }[]),
      workspaceAccessBlock(db, organization.id, requestHeaders),
      loadPermissionSnapshot(db, organization.id, sessionWithUser.user.id),
      loadEnabledModules(db, organization.id),
      db
        .select({
          id: projects.id,
          teamId: projects.teamId,
          visibility: projects.visibility,
        })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organization.id),
            isNull(projects.deletedAt),
          ),
        ),
    ]);

  // An organization can insist on two-factor; until the person has it, the
  // only page they can use is the one that turns it on.
  if (needsTwoFactor && policyRows[0]?.required) {
    redirect(paths.auth.twoFactorRequired());
  }

  // Suspension and the organization's network allow-list apply to pages too,
  // not only to API calls, since pages read the database directly.
  if (accessBlocked) {
    redirect(paths.auth.accessBlocked());
  }

  const role = snapshot.baseRole ?? defaultRole;
  const enabledModuleIds = [...enabledModules] as ModuleId[];
  // Which permissions the user holds anywhere, for navigation and route guards.
  const reachable = reachablePermissions(
    snapshot,
    projectList,
    getCatalogKeys(),
  );

  return {
    organization,
    organizations,
    enabledModules: enabledModuleIds,
    // Already loaded for permission reachability; dashboard queries reuse it.
    projectList,
    roles: {
      user: sessionWithUser.user.role ?? defaultRole,
      organization: role,
    },
    session: sessionWithUser,
    permissions: toPermissionFlags(snapshot),
    reachable,
    snapshot,
    can: (key: string, resource?: ResourceContext) =>
      engineCan(snapshot, key, resource),
  };
});

/**
 * Whether the user can reach a module's pages at all: the permission is held
 * organization-wide or through a role on a project or team.
 */
export async function getModuleAccess(permission: string) {
  const { reachable } = await getDashboardContext();

  return reachable[permission] ?? false;
}

/**
 * Route guard for toggleable modules. A turned-off module never renders; the
 * caller is sent to a short explanation instead.
 */
export async function requireModule(moduleId: ModuleId) {
  const { enabledModules } = await getDashboardContext();

  if (!enabledModules.includes(moduleId)) {
    redirect(paths.moduleDisabled(moduleId));
  }
}
