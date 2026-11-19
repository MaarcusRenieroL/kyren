import { JSX } from "react";

import { UnauthorizedEmptyState } from "~/src/components/workspace/authorization/authorization-boundary";
import { OverviewBoard } from "~/src/components/workspace/overview/overview-board";
import { AdminFrame } from "~/src/components/workspace/settings/frames";
import { getDashboardContext } from "~/src/lib/dashboard-context";
import { getStarterProgress } from "~/src/lib/starter-progress";
import { getRecentActivity } from "~/src/lib/dashboard-data";
import { getViewerTimeZone } from "~/src/lib/viewer-time-zone";
import { getOverviewData } from "~/src/lib/overview-data";

export const metadata = { title: "Overview" };

export default async function OverviewPage(): Promise<JSX.Element> {
  const { organization, session, enabledModules, snapshot, can } =
    await getDashboardContext();

  if (snapshot.baseRole !== "owner" && snapshot.baseRole !== "admin") {
    return (
      <UnauthorizedEmptyState
        title="Overview is for owners and admins"
        description="Your own work is on Today."
      />
    );
  }

  const modules = new Set(enabledModules);
  const timeZone = await getViewerTimeZone();
  const [activity, overview, starter] = await Promise.all([
    getRecentActivity({
      organizationId: organization.id,
      userId: session.user.id,
      enabledModules: modules,
      timeZone,
    }),
    getOverviewData({
      organizationId: organization.id,
      enabledModules: modules,
      timeZone,
      snapshot,
    }),
    getStarterProgress(organization.id),
  ]);

  return (
    <AdminFrame>
      <OverviewBoard
        data={overview}
        activity={activity}
        canSeeAudit={can("audit_logs.view")}
        starter={starter}
        organizationId={organization.id}
      />
    </AdminFrame>
  );
}
