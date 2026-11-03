import type { Metadata } from "next";

import { ImportTasks } from "~/src/components/tasks/import-tasks";

export const metadata: Metadata = { title: "Import tasks" };

export default function ImportTasksPage() {
  return <ImportTasks />;
}
