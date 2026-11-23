import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "@zentro/db/drizzle";
import {
  docs,
  members,
  projects,
  roleAssignments,
  tasks,
  teams,
  users,
} from "@zentro/db/schema";

import { getProjectBySlugSchema } from "../../../types/zod-schema";
import { loadProjectBySlug, projectBySlug } from "../../resources";
import { listProcedure, permissionProcedure } from "../../trpc";

export const projectQueriesProcedures = {
  getProjectsByOrgId: listProcedure("projects.view", "projects").query(
    async ({ ctx }) => {
      const { activeOrganization, db } = ctx;
      const visibleProjectIds =
        await ctx.permissions.viewableProjectIds("projects.view");

      if (!visibleProjectIds.length) {
        return [];
      }

      const projectList = await db
        .select({
          id: projects.id,
          organizationId: projects.organizationId,
          name: projects.name,
          slug: projects.slug,
          taskKeyPrefix: projects.taskKeyPrefix,
          description: projects.description,
          teamId: projects.teamId,
          teamName: teams.name,
          teamColor: teams.color,
          status: projects.status,
          createdById: projects.createdById,
          archivedAt: projects.archivedAt,
          deletedAt: projects.deletedAt,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .leftJoin(teams, eq(teams.id, projects.teamId))
        .where(
          and(
            eq(projects.organizationId, activeOrganization.id),
            inArray(projects.id, visibleProjectIds),
          ),
        )
        .orderBy(asc(projects.name));

      // Task progress per project, only for projects whose tasks the caller can see.
      const taskProjectIds = new Set(
        await ctx.permissions.viewableProjectIds("tasks.view"),
      );
      const countable = projectList
        .map((project) => project.id)
        .filter((id) => taskProjectIds.has(id));
      const progress = countable.length
        ? await db
            .select({
              projectId: tasks.projectId,
              total: count(),
              done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`.mapWith(
                Number,
              ),
              // Open work past its due date, and work that has begun.
              overdue:
                sql<number>`count(*) filter (where ${tasks.status} <> 'done' and ${tasks.dueAt} < now())`.mapWith(
                  Number,
                ),
              started:
                sql<number>`count(*) filter (where ${tasks.status} in ('in-progress', 'review', 'done'))`.mapWith(
                  Number,
                ),
            })
            .from(tasks)
            .where(
              and(
                eq(tasks.organizationId, activeOrganization.id),
                inArray(tasks.projectId, countable),
                isNull(tasks.deletedAt),
                isNull(tasks.archivedAt),
              ),
            )
            .groupBy(tasks.projectId)
        : [];
      const byProject = new Map(
        progress.map((row) => [row.projectId, row] as const),
      );
      // The people most recently given work in each project, newest first.
      const assignees = countable.length
        ? await db
            .select({
              projectId: tasks.projectId,
              name: users.name,
              last: sql<Date>`max(${tasks.updatedAt})`,
            })
            .from(tasks)
            .innerJoin(members, eq(members.id, tasks.assignedToMemberId))
            .innerJoin(users, eq(users.id, members.userId))
            .where(
              and(
                eq(tasks.organizationId, activeOrganization.id),
                inArray(tasks.projectId, countable),
                isNull(tasks.deletedAt),
              ),
            )
            .groupBy(tasks.projectId, users.id, users.name)
            .orderBy(desc(sql`max(${tasks.updatedAt})`))
        : [];
      const contributors = new Map<string, string[]>();

      for (const row of assignees) {
        const list = contributors.get(row.projectId) ?? [];

        if (list.length < 3) list.push(row.name);
        contributors.set(row.projectId, list);
      }

      return projectList.map((project) => ({
        ...project,
        // Null when the caller cannot see this project's tasks.
        totalTasks: taskProjectIds.has(project.id)
          ? (byProject.get(project.id)?.total ?? 0)
          : null,
        doneTasks: taskProjectIds.has(project.id)
          ? (byProject.get(project.id)?.done ?? 0)
          : null,
        overdueTasks: taskProjectIds.has(project.id)
          ? (byProject.get(project.id)?.overdue ?? 0)
          : null,
        startedTasks: taskProjectIds.has(project.id)
          ? (byProject.get(project.id)?.started ?? 0)
          : null,
        contributors: contributors.get(project.id) ?? [],
      }));
    },
  ),

  getProjectBySlug: permissionProcedure(
    "projects.view",
    projectBySlug("slug"),
    {
      module: "projects",
    },
  )
    .input(getProjectBySlugSchema)
    .query(async ({ ctx, input }) => {
      const { slug } = input;
      const { activeOrganization, db } = ctx;

      const [project] = await db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          slug: projects.slug,
          visibility: projects.visibility,
          teamId: projects.teamId,
          teamName: teams.name,
          teamColor: teams.color,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
          status: projects.status,
          taskKeyPrefix: projects.taskKeyPrefix,
          owner: users.name,
        })
        .from(projects)
        .leftJoin(users, eq(users.id, projects.createdById))
        .leftJoin(teams, eq(teams.id, projects.teamId))
        .where(
          and(
            eq(projects.slug, slug),
            eq(projects.organizationId, activeOrganization.id),
          ),
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Counts only cover what the caller may see inside the project.
      const access = (await loadProjectBySlug(ctx, slug)) ?? null;
      const canSeeTasks = await ctx.permissions.can("tasks.view", {
        project: access,
      });
      const canSeeDocs = await ctx.permissions.can("docs.view", {
        project: access,
      });

      // The organization's headcount is for people who may see members;
      // everyone else sees the people with a role on this project.
      const [memberCount] = (await ctx.permissions.can("members.view"))
        ? await db
            .select({ count: count() })
            .from(members)
            .where(eq(members.organizationId, activeOrganization.id))
        : await db
            .select({
              count:
                sql<number>`count(distinct ${roleAssignments.principalId})`.mapWith(
                  Number,
                ),
            })
            .from(roleAssignments)
            .where(
              and(
                eq(roleAssignments.organizationId, activeOrganization.id),
                eq(roleAssignments.scopeType, "project"),
                eq(roleAssignments.scopeId, project.id),
                eq(roleAssignments.principalType, "user"),
              ),
            );

      const [taskCounts] = canSeeTasks
        ? await db
            .select({
              total: count(),
              open: sql<number>`count(*) filter (where ${tasks.status} <> 'done')`.mapWith(
                Number,
              ),
            })
            .from(tasks)
            .innerJoin(projects, eq(projects.id, tasks.projectId))
            .where(
              and(
                eq(projects.slug, slug),
                eq(tasks.organizationId, activeOrganization.id),
                isNull(tasks.deletedAt),
              ),
            )
        : [];

      const [docCount] = canSeeDocs
        ? await db
            .select({ total: count() })
            .from(docs)
            .innerJoin(projects, eq(projects.id, docs.projectId))
            .where(
              and(
                eq(projects.slug, slug),
                eq(docs.organizationId, activeOrganization.id),
                isNull(docs.deletedAt),
              ),
            )
        : [];

      return {
        ...project,
        owner: project.owner ?? "Unknown owner",
        openTasks: taskCounts?.open ?? 0,
        totalTasks: taskCounts?.total ?? 0,
        totalDocs: docCount?.total ?? 0,
        totalMembers: memberCount?.count ?? 0,
      };
    }),
};
