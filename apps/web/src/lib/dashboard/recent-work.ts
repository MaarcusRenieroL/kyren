import { db } from "@zentro/db";
import { and, desc, eq, isNull } from "@zentro/db/drizzle";
import { docs, projects, tasks } from "@zentro/db/schema";
import { paths } from "~/src/lib/paths";
import {
  formatRelativeDate,
  when,
  type DashboardLinks,
  type DashboardWorkItem,
  type Viewer,
} from "./types";
import { visibleScope } from "./visible-scope";

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
