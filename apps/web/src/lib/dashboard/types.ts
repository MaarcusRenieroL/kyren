import type { PermissionSnapshot } from "@zentro/permissions";

export type DashboardStat = {
  value: number;
  label: string;
};

export type DashboardActivityPill = {
  kind: "tasks" | "docs";
  label: string;
};

export type DashboardTaskItem = {
  id: string;
  title: string;
  priority: string | null;
  status: string;
  href: string;
};

export type DashboardWorkItem = {
  id: string;
  kind: "doc" | "project" | "task";
  title: string;
  label: string;
  updatedAt: string;
  href: string;
};

export type DashboardActivityItem = {
  id: string;
  user: string;
  userInitials: string;
  action: string;
  target: string;
  app: "Tasks" | "Docs" | "Projects" | "Workspace";
  time: string;
  kind: "created" | "updated" | "completed" | "commented";
  href: string;
};

export type DashboardLinks = {
  docs?: string;
  newDoc?: string;
  projects?: string;
  tasks?: string;
  newTask?: string;
};

export type DashboardData = {
  activityPills: DashboardActivityPill[];
  workspaceStats: DashboardStat[];
  recentWork: DashboardWorkItem[];
  recentActivity: DashboardActivityItem[];
  tasks: DashboardTaskItem[];
  modules: {
    projects: boolean;
    tasks: boolean;
    docs: boolean;
  };
  links: DashboardLinks;
};

export type Viewer = {
  organizationId: string;
  userId: string;
  enabledModules: ReadonlySet<string>;
  snapshot: PermissionSnapshot;
  /** The viewer's IANA zone, already checked with `safeTimeZone`. */
  timeZone: string;
};

export function pluralize(
  countValue: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${countValue} ${countValue === 1 ? singular : plural}`;
}

export function getInitials(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (!parts.length) {
    return "UN";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatRelativeDate(value: Date | null, timeZone: string) {
  if (!value) {
    return "Recently";
  }

  const delta = Date.now() - value.getTime();
  const minutes = Math.max(0, Math.round(delta / 60000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  });
}

// Disabled modules are not queried; their widgets stay empty.
export function when<T>(enabled: boolean, query: () => PromiseLike<T[]>) {
  return enabled ? query() : Promise.resolve<T[]>([]);
}
