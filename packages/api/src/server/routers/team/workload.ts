import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or } from "@kyren/db/drizzle";
import {
  members,
  projects,
  tasks,
  teamMembers,
  teams,
  users,
} from "@kyren/db/schema";

import { getTeamByIdSchema } from "../../../types/zod-schema";
import { permissionProcedure } from "../../trpc";
import { teamById } from "../../resources";

export const teamWorkloadProcedures = {
  getTeamWorkload: permissionProcedure("teams.view", teamById("id"))
    .input(getTeamByIdSchema)
    .query(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;

      const [team] = await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(
          and(
            eq(teams.id, input.id),
            eq(teams.organizationId, activeOrganization.id),
          ),
        )
        .limit(1);

      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found.",
        });
      }

      // Team members
      const teamMemberList = await db
        .select({
          memberId: members.id,
          userId: users.id,
          name: users.name,
          email: users.email,
        })
        .from(teamMembers)
        .innerJoin(members, eq(members.id, teamMembers.memberId))
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(teamMembers.teamId, input.id));

      const memberIds = teamMemberList.map((m) => m.memberId);
      const visibleProjects =
        await ctx.permissions.viewableProjectIds("tasks.view");

      // Tasks either owned by this team, or assigned to a member of this team across any project
      const teamTasks = await db
        .select({
          id: tasks.id,
          key: tasks.key,
          name: tasks.name,
          status: tasks.status,
          priority: tasks.priority,
          estimatePoints: tasks.estimatePoints,
          dueAt: tasks.dueAt,
          projectId: projects.id,
          projectName: projects.name,
          projectSlug: projects.slug,
          assignedToMemberId: tasks.assignedToMemberId,
          assigneeName: users.name,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .leftJoin(members, eq(members.id, tasks.assignedToMemberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(tasks.organizationId, activeOrganization.id),
            isNull(tasks.deletedAt),
            inArray(tasks.projectId, visibleProjects),
            memberIds.length
              ? or(
                  eq(tasks.teamId, input.id),
                  inArray(tasks.assignedToMemberId, memberIds),
                )
              : eq(tasks.teamId, input.id),
          ),
        )
        .orderBy(desc(tasks.createdAt));

      const now = new Date();
      const openTasks = teamTasks.filter((t) => t.status !== "done");

      // Per-member capacity breakdown
      const memberWorkload = teamMemberList.map((member) => {
        const assigned = openTasks.filter(
          (t) => t.assignedToMemberId === member.memberId,
        );
        const inProgress = assigned.filter(
          (t) => t.status === "in-progress",
        ).length;
        const overdue = assigned.filter(
          (t) => t.dueAt && new Date(t.dueAt).getTime() < now.getTime(),
        ).length;
        const totalPoints = assigned.reduce(
          (sum, t) => sum + (t.estimatePoints ?? 0),
          0,
        );
        const utilizationPercent = Math.min(
          200,
          Math.round((assigned.length / 5) * 100),
        );
        const isOverloaded = assigned.length > 5 || overdue > 1;
        const isUnderutilized = assigned.length <= 1;

        return {
          memberId: member.memberId,
          userId: member.userId,
          name: member.name || member.email,
          openCount: assigned.length,
          inProgressCount: inProgress,
          overdueCount: overdue,
          totalPoints,
          utilizationPercent,
          isOverloaded,
          isUnderutilized,
        };
      });

      return {
        team,
        totalTasks: teamTasks.length,
        openTasksCount: openTasks.length,
        doneTasksCount: teamTasks.length - openTasks.length,
        memberWorkload,
        tasks: teamTasks.slice(0, 100),
      };
    }),
};
