import type { Metadata } from "next";

import { TaskTrash } from "~/src/features/tasks/components/trash/task-trash";

export const metadata: Metadata = { title: "Deleted tasks" };

export default function TaskTrashPage() {
  return <TaskTrash />;
}
