import {
  createPermissionContext,
  visibleActivityCondition,
} from "@zentro/api/server";
import { actorName, describeEvent } from "@zentro/audit";
import { db } from "@zentro/db";
import {
  can,
  reachablePermissions,
  type PermissionSnapshot,
} from "@zentro/permissions";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "@zentro/db/drizzle";
import {
  activityEvents,
  docs,
  members,
  projects,
  tasks,
  teams,
  users,
} from "@zentro/db/schema";
import type { ModuleId } from "@zentro/modules";
import { paths } from "~/src/lib/paths";
import { zonedMidnight } from "~/src/lib/time-zone";

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
  priority: string;
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
  app: string;
  time: string;
  kind: "created" | "updated" | "completed" | "commented";
  href: string;
};

/** Links to the work modules the caller can reach; disabled ones are left out. */
export type DashboardLinks = {
  docs?: string;
  projects?: string;
  tasks?: string;
  newDoc?: string;
  newTask?: string;
};

/**
 * Counts and lists computed for the dashboard. Today and Overview render only
 * `recentWork`, `links` and `recentActivity`, through `getRecentWork` and
 * `getRecentActivity`; the rest has no screen (see SLOP.md).
 */
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

type Viewer = {
  organizationId: string;
  userId: string;
  enabledModules: ReadonlySet<string>;
  snapshot: PermissionSnapshot;
  /** The viewer's IANA zone, already checked with `safeTimeZone`. */
  timeZone: string;
};

function pluralize(
  countValue: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${countValue} ${countValue === 1 ? singular : plural}`;
}

function getInitials(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (!parts.length) {
    return "UN";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatRelativeDate(value: Date | null, timeZone: string) {
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
function when<T>(enabled: boolean, query: () => PromiseLike<T[]>) {
  return enabled ? query() : Promise.resolve<T[]>([]);
}

/**
 * What the caller may see: projects hidden from them, and the tasks and docs
 * inside those projects, stay out of every query that uses these conditions.
 */
async function visibleScope(
  organizationId: string,
  snapshot: PermissionSnapshot,
) {
  const projectRows = await db
    .select({
      id: projects.id,
      teamId: projects.teamId,
      visibility: projects.visibility,
    })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, organizationId),
        isNull(projects.deletedAt),
      ),
    );
  // What the caller can reach anywhere: organization-wide, or through a role
  // on a project or team. A project-only person still gets their links.
  const reachable = reachablePermissions(snapshot, projectRows, [
    "projects.view",
    "tasks.view",
    "tasks.create",
    "docs.view",
    "docs.create",
    "members.view",
    "teams.view",
  ]);
  const idsFor = (key: string) =>
    projectRows
      .filter((project) => can(snapshot, key, { project }))
      .map((project) => project.id);
  const projectIds = idsFor("projects.view");
  const taskProjectIds = idsFor("tasks.view");
  const docProjectIds = idsFor("docs.view");
  const projectsVisible = projectIds.length
    ? inArray(projects.id, projectIds)
    : sql`false`;
  const tasksVisible = taskProjectIds.length
    ? inArray(tasks.projectId, taskProjectIds)
    : sql`false`;
  const docsEverywhere = can(snapshot, "docs.view");
  // A role given on a team covers that team's docs outside any project.
  const docTeamIds = docsEverywhere
    ? []
    : Array.from(
        new Set(
          snapshot.assignments
            .filter((assignment) => assignment.scopeType === "team")
            .map((assignment) => assignment.scopeId),
        ),
      ).filter((teamId) => can(snapshot, "docs.view", { teamId }));
  const docsVisible =
    or(
      docsEverywhere ? isNull(docs.projectId) : undefined,
      docTeamIds.length
        ? and(isNull(docs.projectId), inArray(docs.teamId, docTeamIds))
        : undefined,
      docProjectIds.length ? inArray(docs.projectId, docProjectIds) : undefined,
    ) ?? sql`false`;

  return { reachable, projectsVisible, tasksVisible, docsVisible };
}

/**
 * Today's "Jump back in": the latest docs, projects and tasks the caller can
 * see, and links to the modules they can reach.
 */
export async function getRecentWork({
  organizationId,
  enabledModules,
  snapshot,
  timeZone,
}: Omit<Viewer, "userId">): Promise<{
  recentWork: DashboardWorkItem[];
  links: DashboardLinks;
}> {
  const { reachable, projectsVisible, tasksVisible, docsVisible } =
    await visibleScope(organizationId, snapshot);

  const [recentProjects, recentDocs, recentTasks] = await Promise.all([
    when(enabledModules.has("projects"), () =>
      db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            projectsVisible,
            isNull(projects.deletedAt),
          ),
        )
        .orderBy(desc(projects.updatedAt))
        .limit(3),
    ),
    when(enabledModules.has("docs"), () =>
      db
        .select({
          id: docs.id,
          title: docs.title,
          slug: docs.slug,
          updatedAt: docs.updatedAt,
        })
        .from(docs)
        .where(
          and(
            eq(docs.organizationId, organizationId),
            docsVisible,
            isNull(docs.deletedAt),
          ),
        )
        .orderBy(desc(docs.updatedAt))
        .limit(3),
    ),
    when(enabledModules.has("tasks"), () =>
      db
        .select({
          id: tasks.id,
          key: tasks.key,
          name: tasks.name,
          updatedAt: tasks.updatedAt,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            tasksVisible,
            isNull(tasks.deletedAt),
          ),
        )
        .orderBy(desc(tasks.updatedAt))
        .limit(2),
    ),
  ]);

  const recentWork: DashboardWorkItem[] = [
    ...recentDocs.map((doc) => ({
      id: doc.id,
      kind: "doc" as const,
      title: doc.title,
      label: "Docs",
      updatedAt: formatRelativeDate(doc.updatedAt, timeZone),
      href: paths.doc(doc.slug),
    })),
    ...recentProjects.map((project) => ({
      id: project.id,
      kind: "project" as const,
      title: project.name,
      label: "Projects",
      updatedAt: formatRelativeDate(project.updatedAt, timeZone),
      href: paths.project(project.slug),
    })),
    ...recentTasks.map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: task.name,
      label: "Tasks",
      updatedAt: formatRelativeDate(task.updatedAt, timeZone),
      href: paths.task(task.key),
    })),
  ].slice(0, 5);

  const links: DashboardLinks = {
    ...(enabledModules.has("docs") && reachable["docs.view"]
      ? {
          docs: paths.docs(),
          ...(reachable["docs.create"] ? { newDoc: paths.docs() } : {}),
        }
      : {}),
    ...(enabledModules.has("projects") && reachable["projects.view"]
      ? { projects: paths.projects() }
      : {}),
    ...(enabledModules.has("tasks") && reachable["tasks.view"]
      ? {
          tasks: paths.tasks(),
          ...(reachable["tasks.create"] ? { newTask: paths.tasks() } : {}),
        }
      : {}),
  };

  return { recentWork, links };
}

/** Overview's recent activity: the latest events the caller may see. */
export async function getRecentActivity({
  organizationId,
  userId,
  enabledModules,
  timeZone,
}: Omit<Viewer, "snapshot">): Promise<DashboardActivityItem[]> {
  // Everything the caller may see, from the unified store.
  const recentEvents = await visibleActivityCondition(
    createPermissionContext(db, organizationId, userId),
    enabledModules as ReadonlySet<ModuleId>,
  ).then((visible) =>
    db
      .select({
        id: activityEvents.id,
        action: activityEvents.action,
        targetType: activityEvents.targetType,
        targetLabel: activityEvents.targetLabel,
        metadata: activityEvents.metadata,
        createdAt: activityEvents.createdAt,
        actorUserId: activityEvents.actorUserId,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(activityEvents)
      .leftJoin(users, eq(users.id, activityEvents.actorUserId))
      .where(
        and(
          eq(activityEvents.organizationId, organizationId),
          eq(activityEvents.auditOnly, false),
          visible,
        ),
      )
      .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
      .limit(6),
  );

  return recentEvents.map((event) => {
    const name = actorName(
      event.actorName || event.actorEmail
        ? { name: event.actorName, email: event.actorEmail }
        : null,
      event.actorUserId,
    );
    const sentence = describeEvent(
      {
        action: event.action,
        targetType: event.targetType,
        targetLabel: event.targetLabel,
        metadata: event.metadata,
      },
      name,
    );
    const slug =
      typeof event.metadata?.slug === "string" ? event.metadata.slug : null;

    return {
      id: event.id,
      user: name,
      userInitials: getInitials(event.actorName ?? event.actorEmail),
      // The sentence without the actor, which the card shows in bold.
      action: sentence.slice(name.length).trim(),
      target: "",
      app:
        event.targetType === "task"
          ? "Tasks"
          : event.targetType === "doc"
            ? "Docs"
            : event.targetType === "project"
              ? "Projects"
              : "Workspace",
      time: formatRelativeDate(event.createdAt, timeZone),
      kind:
        event.action === "task.status_changed" &&
        (
          event.metadata?.changes as Array<{ to: string | null }> | undefined
        )?.[0]?.to === "done"
          ? "completed"
          : event.action.includes("comment")
            ? "commented"
            : event.action.endsWith("created")
              ? "created"
              : "updated",
      href:
        event.targetType === "task" && event.targetLabel
          ? paths.task(event.targetLabel)
          : event.targetType === "doc" && slug
            ? paths.doc(slug)
            : event.targetType === "project" && slug
              ? paths.project(slug)
              : paths.dashboard(),
    };
  });
}

/** Every dashboard number and list for the caller; see `DashboardData`. */
export async function getDashboardData(viewer: Viewer): Promise<DashboardData> {
  const { organizationId, userId, enabledModules, snapshot, timeZone } = viewer;
  // The viewer's day: from their midnight up to the next one.
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
