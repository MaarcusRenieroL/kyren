import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull } from "@kyren/db/drizzle";
import { members, projects, tasks, teams, users, workLinks } from "@kyren/db/schema";

import { getProjectBySlugSchema } from "../../../types/zod-schema";
import { loadProjectBySlug, projectBySlug } from "../../resources";
import { permissionProcedure } from "../../trpc";

export const projectDependenciesProcedures = {
  getDependencyGraph: permissionProcedure(
    "projects.view",
    projectBySlug("slug"),
    {
      module: "projects",
    },
  )
    .input(getProjectBySlugSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const { slug } = input;

      // The graph is made of tasks, so it needs the right to see them.
      if (
        !(await ctx.permissions.can("tasks.view", {
          project: (await loadProjectBySlug(ctx, slug)) ?? null,
        }))
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view tasks in this project.",
        });
      }

      const [project] = await db
        .select({ id: projects.id, name: projects.name, slug: projects.slug })
        .from(projects)
        .where(
          and(
            eq(projects.slug, slug),
            eq(projects.organizationId, activeOrganization.id),
          ),
        );

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found.",
        });
      }

      const projectTasks = await db
        .select({
          id: tasks.id,
          key: tasks.key,
          title: tasks.name,
          status: tasks.status,
          priority: tasks.priority,
          estimatePoints: tasks.estimatePoints,
          dueAt: tasks.dueAt,
          assignee: users.name,
          teamName: teams.name,
        })
        .from(tasks)
        .leftJoin(teams, eq(teams.id, tasks.teamId))
        .leftJoin(members, eq(members.id, tasks.assignedToMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(tasks.projectId, project.id),
            eq(tasks.organizationId, activeOrganization.id),
            isNull(tasks.deletedAt),
          ),
        )
        .orderBy(asc(tasks.taskNumber));

      const taskMap = new Map(projectTasks.map((t) => [t.id, t]));
      const taskIds = projectTasks.map((t) => t.id);

      const links = taskIds.length
        ? await db
            .select({
              sourceId: workLinks.sourceId,
              targetId: workLinks.targetId,
            })
            .from(workLinks)
            .where(
              and(
                eq(workLinks.organizationId, activeOrganization.id),
                eq(workLinks.kind, "blocks"),
                eq(workLinks.sourceType, "task"),
                eq(workLinks.targetType, "task"),
                inArray(workLinks.sourceId, taskIds),
                inArray(workLinks.targetId, taskIds),
              ),
            )
        : [];

      const outgoing = new Map<string, string[]>();
      const incoming = new Map<string, string[]>();

      for (const t of projectTasks) {
        outgoing.set(t.id, []);
        incoming.set(t.id, []);
      }

      const edges: Array<{
        sourceKey: string;
        targetKey: string;
        isBlockerDone: boolean;
        isBlockedDone: boolean;
      }> = [];

      for (const link of links) {
        const source = taskMap.get(link.sourceId);
        const target = taskMap.get(link.targetId);
        if (source && target) {
          outgoing.get(source.id)!.push(target.id);
          incoming.get(target.id)!.push(source.id);
          edges.push({
            sourceKey: source.key,
            targetKey: target.key,
            isBlockerDone: source.status === "done",
            isBlockedDone: target.status === "done",
          });
        }
      }

      const stages = new Map<string, number>();
      for (const t of projectTasks) {
        stages.set(t.id, 0);
      }

      for (let iter = 0; iter < projectTasks.length; iter++) {
        let changed = false;
        for (const link of links) {
          const uStage = stages.get(link.sourceId) ?? 0;
          const vStage = stages.get(link.targetId) ?? 0;
          if (vStage <= uStage) {
            stages.set(link.targetId, uStage + 1);
            changed = true;
          }
        }
        if (!changed) break;
      }

      const memoPath = new Map<string, string[]>();
      // Tasks on the path being walked; a link back to one is a loop, and
      // following it would never end.
      const walking = new Set<string>();
      function getLongestChain(id: string): string[] {
        if (memoPath.has(id)) return memoPath.get(id)!;
        walking.add(id);
        const children = (outgoing.get(id) ?? []).filter(
          (cid) => taskMap.get(cid)?.status !== "done" && !walking.has(cid),
        );
        let bestChildPath: string[] = [];
        for (const cid of children) {
          const childPath = getLongestChain(cid);
          if (childPath.length > bestChildPath.length) {
            bestChildPath = childPath;
          }
        }
        const result = [id, ...bestChildPath];
        walking.delete(id);
        memoPath.set(id, result);
        return result;
      }

      let longestCriticalChain: string[] = [];
      for (const t of projectTasks) {
        if (t.status !== "done") {
          const openBlockers = (incoming.get(t.id) ?? []).filter(
            (bid) => taskMap.get(bid)?.status !== "done",
          );
          if (openBlockers.length === 0) {
            const chain = getLongestChain(t.id);
            if (chain.length > longestCriticalChain.length) {
              longestCriticalChain = chain;
            }
          }
        }
      }

      const criticalPathSet = new Set(
        longestCriticalChain.map((id) => taskMap.get(id)?.key).filter(Boolean),
      );

      const bottlenecks: string[] = [];
      const nodes = projectTasks.map((t) => {
        const blocksCount = (outgoing.get(t.id) ?? []).filter(
          (cid) => taskMap.get(cid)?.status !== "done",
        ).length;
        const blockedByCount = (incoming.get(t.id) ?? []).filter(
          (bid) => taskMap.get(bid)?.status !== "done",
        ).length;
        const isBottleneck = t.status !== "done" && blocksCount >= 2;
        if (isBottleneck) bottlenecks.push(t.key);

        return {
          id: t.id,
          key: t.key,
          title: t.title,
          status: t.status,
          priority: t.priority,
          estimatePoints: t.estimatePoints,
          dueAt: t.dueAt ? t.dueAt.toISOString() : null,
          assignee: t.assignee ?? "Unassigned",
          teamName: t.teamName ?? null,
          stage: stages.get(t.id) ?? 0,
          blocksCount,
          blockedByCount,
          isCritical: criticalPathSet.has(t.key),
          isBottleneck,
        };
      });

      const now = Date.now();
      const hasOverdueCritical = nodes.some(
        (n) =>
          n.isCritical &&
          n.dueAt &&
          new Date(n.dueAt).getTime() < now &&
          n.status !== "done",
      );

      const riskLevel =
        hasOverdueCritical ||
        (longestCriticalChain.length >= 3 && bottlenecks.length >= 2)
          ? "high"
          : bottlenecks.length >= 1 || longestCriticalChain.length >= 2
            ? "moderate"
            : "low";

      return {
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
        },
        nodes,
        edges,
        criticalPath: Array.from(criticalPathSet) as string[],
        bottlenecks,
        metrics: {
          totalTasks: nodes.length,
          totalDependencies: edges.length,
          criticalPathLength: longestCriticalChain.length,
          blockedTasksCount: nodes.filter((n) => n.blockedByCount > 0).length,
          bottlenecksCount: bottlenecks.length,
          riskLevel,
        },
      };
    }),
};
