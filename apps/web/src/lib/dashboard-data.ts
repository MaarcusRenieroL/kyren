import { db } from "@kyren/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  lte,
  ne,
  or,
} from "@kyren/db/drizzle";
import {
  docs,
  members,
  projects,
  tasks,
  teams,
} from "@kyren/db/schema";
import { paths } from "~/src/lib/paths";
import { zonedMidnight } from "~/src/lib/time-zone";

import { getRecentActivity } from "./dashboard/recent-activity";
import { getRecentWork } from "./dashboard/recent-work";
import {
  pluralize,
  when,
  type DashboardData,
  type Viewer,
} from "./dashboard/types";
import { visibleScope } from "./dashboard/visible-scope";

export * from "./dashboard/types";
export { visibleScope } from "./dashboard/visible-scope";
export { getRecentWork } from "./dashboard/recent-work";
export { getRecentActivity } from "./dashboard/recent-activity";

/** Every dashboard number and list for the caller; see `DashboardData`. */
export async function getDashboardData(viewer: Viewer): Promise<DashboardData> {
  const { organizationId, userId, enabledModules, snapshot, timeZone } = viewer;
  const now = new Date();
  const todayStart = zonedMidnight(timeZone, now);
  const todayEnd = new Date(zonedMidnight(timeZone, now, -1).getTime() - 1);
  const { reachable, projectsVisible, tasksVisible, docsVisible } =
    await visibleScope(organizationId, snapshot);

  const [
    memberCount,
    projectCount,
    activeProjectCount,
    taskCount,
    openTaskCount,
    dueTodayTaskCount,
    docCount,
    docsUpdatedTodayCount,
    teamCount,
    currentMember,
    recent,
    recentActivity,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(members)
      .where(eq(members.organizationId, organizationId)),
    when(enabledModules.has("projects"), () =>
      db
        .select({ count: count() })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            projectsVisible,
            isNull(projects.deletedAt),
          ),
        ),
    ),
    when(enabledModules.has("projects"), () =>
      db
        .select({ count: count() })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            projectsVisible,
            eq(projects.status, "active"),
            isNull(projects.deletedAt),
          ),
        ),
    ),
    when(enabledModules.has("tasks"), () =>
      db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            tasksVisible,
            isNull(tasks.deletedAt),
          ),
        ),
    ),
    when(enabledModules.has("tasks"), () =>
      db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            tasksVisible,
            ne(tasks.status, "done"),
            isNull(tasks.deletedAt),
          ),
        ),
    ),
    when(enabledModules.has("tasks"), () =>
      db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            tasksVisible,
            ne(tasks.status, "done"),
            isNull(tasks.deletedAt),
            gte(tasks.dueAt, todayStart),
            lte(tasks.dueAt, todayEnd),
          ),
        ),
    ),
    when(enabledModules.has("docs"), () =>
      db
        .select({ count: count() })
        .from(docs)
        .where(
          and(
            eq(docs.organizationId, organizationId),
            docsVisible,
            isNull(docs.deletedAt),
          ),
        ),
    ),
    when(enabledModules.has("docs"), () =>
      db
        .select({ count: count() })
        .from(docs)
        .where(
          and(
            eq(docs.organizationId, organizationId),
            docsVisible,
            isNull(docs.deletedAt),
            gte(docs.updatedAt, todayStart),
            lte(docs.updatedAt, todayEnd),
          ),
        ),
    ),
    db
      .select({ count: count() })
      .from(teams)
      .where(
        and(eq(teams.organizationId, organizationId), isNull(teams.archivedAt)),
      ),
    db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.organizationId, organizationId),
          eq(members.userId, userId),
        ),
      )
      .limit(1),
    getRecentWork(viewer),
    getRecentActivity(viewer),
  ]);

  const memberId = currentMember[0]?.id;
  const assignedTasks =
    memberId && enabledModules.has("tasks")
      ? await db
          .select({
            id: tasks.id,
            key: tasks.key,
            name: tasks.name,
            status: tasks.status,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            updatedAt: tasks.updatedAt,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.organizationId, organizationId),
              tasksVisible,
              eq(tasks.assignedToMemberId, memberId),
              isNull(tasks.deletedAt),
              or(ne(tasks.status, "done"), isNull(tasks.completedAt)),
            ),
          )
          .orderBy(asc(tasks.dueAt), desc(tasks.updatedAt))
          .limit(4)
      : [];

  const taskItems = assignedTasks.slice(0, 4).map((task) => ({
    id: task.id,
    title: task.name,
    priority: task.priority,
    status: task.status,
    href: paths.task(task.key),
  }));

  const modules = {
    projects: enabledModules.has("projects"),
    tasks: enabledModules.has("tasks"),
    docs: enabledModules.has("docs"),
  };

  return {
    activityPills: [
      ...(modules.tasks
        ? [
            {
              kind: "tasks" as const,
              label: pluralize(
                dueTodayTaskCount[0]?.count ?? 0,
                "task due",
                "tasks due",
              ),
            },
          ]
        : []),
      ...(modules.docs
        ? [
            {
              kind: "docs" as const,
              label: pluralize(
                docsUpdatedTodayCount[0]?.count ?? 0,
                "doc updated",
                "docs updated",
              ),
            },
          ]
        : []),
    ],
    workspaceStats: [
      ...(reachable["members.view"]
        ? [{ value: memberCount[0]?.count ?? 0, label: "Members" }]
        : []),
      ...(modules.projects
        ? [
            {
              value:
                activeProjectCount[0]?.count ?? projectCount[0]?.count ?? 0,
              label: "Projects",
            },
          ]
        : []),
      ...(modules.tasks
        ? [
            {
              value: openTaskCount[0]?.count ?? taskCount[0]?.count ?? 0,
              label: "Open tasks",
            },
          ]
        : []),
      ...(modules.docs
        ? [{ value: docCount[0]?.count ?? 0, label: "Docs" }]
        : []),
      ...(reachable["teams.view"]
        ? [{ value: teamCount[0]?.count ?? 0, label: "Teams" }]
        : []),
    ],
    recentWork: recent.recentWork,
    recentActivity,
    tasks: taskItems,
    modules,
    links: recent.links,
  };
}
