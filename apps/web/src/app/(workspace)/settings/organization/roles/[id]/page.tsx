import { JSX } from "react";

import { AuthorizationBoundary } from "~/src/components/workspace/authorization/authorization-boundary";
import { RoleEditor } from "~/src/components/workspace/roles/role-editor";
import { getAuthorizedDashboardContext } from "~/src/lib/dashboard-context";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RoleSettingsPage({
  params,
}: Props): Promise<JSX.Element> {
  const { id } = await params;
  const { authorization } = await getAuthorizedDashboardContext("roles.view");

  return (
    <AuthorizationBoundary
      isAllowed={authorization.isAllowed}
      permission={authorization.permission}
    >
      <RoleEditor roleId={id} />
    </AuthorizationBoundary>
  );
}
