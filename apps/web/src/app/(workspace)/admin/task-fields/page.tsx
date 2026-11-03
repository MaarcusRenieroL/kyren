import type { Metadata } from "next";

import { TaskFields } from "~/src/components/admin/task-fields";

export const metadata: Metadata = { title: "Task fields" };

export default function AdminTaskFieldsPage() {
  return <TaskFields />;
}
