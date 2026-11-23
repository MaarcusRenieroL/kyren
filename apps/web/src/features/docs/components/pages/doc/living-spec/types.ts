export interface LivingSpecTask {
  linkId: string;
  id: string;
  key: string | null;
  title: string;
  status: string | null;
  assignee: string | null;
  priority?: string | null;
  estimatePoints?: number | null;
  href: string;
  relation: string;
}

export const statusOptions = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
] as const;
