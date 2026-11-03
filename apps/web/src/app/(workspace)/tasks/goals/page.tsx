import type { Metadata } from "next";

import { Goals } from "~/src/features/tasks/components/goals/goals";
import { getModuleAccess } from "~/src/lib/dashboard-context";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  return <Goals canManage={await getModuleAccess("tasks.manage_goals")} />;
}
