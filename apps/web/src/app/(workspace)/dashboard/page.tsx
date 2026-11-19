import { JSX } from "react";

import { TodayView } from "~/src/features/today/today-view";
import { getDashboardContext } from "~/src/lib/dashboard-context";
import { getRecentWork } from "~/src/lib/dashboard-data";
import { getViewerTimeZone } from "~/src/lib/viewer-time-zone";
import { getStarterProgress } from "~/src/lib/starter-progress";
import { getTodayData } from "~/src/lib/today-data";

export default async function TodayPage(): Promise<JSX.Element> {
  const { organization, session, enabledModules, snapshot } =
    await getDashboardContext();
  const modules = new Set(enabledModules);
  const timeZone = await getViewerTimeZone();
  const [today, recent, starter] = await Promise.all([
    getTodayData({
      organizationId: organization.id,
      userId: session.user.id,
      enabledModules: modules,
      snapshot,
      timeZone,
    }),
    getRecentWork({
      organizationId: organization.id,
      enabledModules: modules,
      snapshot,
      timeZone,
    }),
    getStarterProgress(organization.id),
  ]);

  return (
    <TodayView
      firstName={session.user.name.split(" ")[0] ?? session.user.name}
      data={today}
      recentWork={recent.recentWork}
      links={recent.links}
      starter={starter}
      organizationId={organization.id}
    />
  );
}
