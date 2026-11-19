import { JSX } from "react";

import { AuthorizationBoundary } from "~/src/components/workspace/authorization/authorization-boundary";
import { AccessCheck } from "~/src/components/workspace/roles/access-check";
import { getAuthorizedDashboardContext } from "~/src/lib/dashboard-context";

export default async function AccessCheckSettingsPage(): Promise<JSX.Element> {
  const { authorization } = await getAuthorizedDashboardContext(
    "permissions.explain",
  );

  return (
    <AuthorizationBoundary
      isAllowed={authorization.isAllowed}
      permission={authorization.permission}
    >
      <AccessCheck />
    </AuthorizationBoundary>
  );
}
