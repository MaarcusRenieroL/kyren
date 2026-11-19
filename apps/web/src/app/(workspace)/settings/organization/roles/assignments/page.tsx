import { JSX } from "react";

import { AuthorizationBoundary } from "~/src/components/workspace/authorization/authorization-boundary";
import { AssignmentsView } from "~/src/components/workspace/roles/assignments-view";
import { getAuthorizedDashboardContext } from "~/src/lib/dashboard-context";

export default async function AssignmentsSettingsPage(): Promise<JSX.Element> {
  const { authorization } = await getAuthorizedDashboardContext("roles.view");

  return (
    <AuthorizationBoundary
      isAllowed={authorization.isAllowed}
      permission={authorization.permission}
    >
      <AssignmentsView />
    </AuthorizationBoundary>
  );
}
