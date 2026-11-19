import { JSX } from "react";

import { AuthorizationBoundary } from "~/src/components/workspace/authorization/authorization-boundary";
import { RolesList } from "~/src/components/workspace/roles/roles-list";
import { getAuthorizedDashboardContext } from "~/src/lib/dashboard-context";

export default async function RolesSettingsPage(): Promise<JSX.Element> {
  const { authorization } = await getAuthorizedDashboardContext("roles.view");

  return (
    <AuthorizationBoundary
      isAllowed={authorization.isAllowed}
      permission={authorization.permission}
    >
      <RolesList />
    </AuthorizationBoundary>
  );
}
