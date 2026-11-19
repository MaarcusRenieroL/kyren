import { JSX } from "react";

import { AuthorizationBoundary } from "~/src/components/workspace/authorization/authorization-boundary";
import { PermissionLog } from "~/src/components/workspace/roles/permission-log";
import { getAuthorizedDashboardContext } from "~/src/lib/dashboard-context";

export default async function PermissionLogSettingsPage(): Promise<JSX.Element> {
  const { authorization } = await getAuthorizedDashboardContext(
    "permissions.log.view",
  );

  return (
    <AuthorizationBoundary
      isAllowed={authorization.isAllowed}
      permission={authorization.permission}
    >
      <PermissionLog />
    </AuthorizationBoundary>
  );
}
