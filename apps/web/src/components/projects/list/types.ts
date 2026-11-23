export type ProjectListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  status: string;
  taskKeyPrefix?: string | null;
  totalTasks?: number | null;
  doneTasks?: number | null;
  overdueTasks?: number | null;
  startedTasks?: number | null;
  /** Up to three people most recently given work here. */
  contributors?: string[];
  updatedAt: Date;
};

export type ProjectListProps = {
  isLoading: boolean;
  projects: ProjectListItem[];
  view: "grid" | "list";
  hasFilters: boolean;
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  /** Heading of the non-favorite group, such as "All active projects". */
  groupLabel: string;
};

export const tints = [
  "bg-tint-tasks",
  "bg-tint-projects",
  "bg-tint-docs",
  "bg-tint-teams",
  "bg-tint-audit",
] as const;

export function tintFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tints[hash % tints.length];
}

export function formatUpdated(updatedAt: Date) {
  const days = Math.floor((Date.now() - updatedAt.getTime()) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";

  return updatedAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export type Health = "archived" | "risk" | "planning" | "track" | "active";

/** Where a project stands, read from its tasks rather than typed in. */
export function projectHealth(project: ProjectListItem): Health {
  if (project.status === "archived") return "archived";
  if (project.totalTasks == null) return "active";
  if ((project.overdueTasks ?? 0) > 0) return "risk";
  if (!project.totalTasks || !project.startedTasks) return "planning";

  return "track";
}

export const healthLabel: Record<Health, string> = {
  archived: "Archived",
  risk: "At risk",
  planning: "Planning",
  track: "On track",
  active: "Active",
};
