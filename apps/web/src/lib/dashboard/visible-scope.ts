import { db } from "@zentro/db";
import {
  can,
  reachablePermissions,
  type PermissionSnapshot,
} from "@zentro/permissions";
import {
  and,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from "@zentro/db/drizzle";
import {
  docs,
  projects,
  tasks,
} from "@zentro/db/schema";

/**
 * What the caller may see: projects hidden from them, and the tasks and docs
 * inside those projects, stay out of every query that uses these conditions.
 */
export async function visibleScope(
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
