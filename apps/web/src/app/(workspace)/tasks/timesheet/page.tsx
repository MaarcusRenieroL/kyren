import type { Metadata } from "next";

import { Timesheet } from "~/src/features/tasks/components/timesheet/timesheet";
import { getModuleAccess } from "~/src/lib/dashboard-context";

export const metadata: Metadata = { title: "Timesheet" };

export default async function TimesheetPage() {
  return <Timesheet canSeeReport={await getModuleAccess("time.view_report")} />;
}
