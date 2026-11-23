import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "@kyren/db/drizzle";
import { chatMembers, docs, projects, tasks, teams } from "@kyren/db/schema";
import { z } from "zod";

import { memberProfiles, normalizeChannelName } from "../../chat";
import { visibleDocsCondition } from "../../access";
import { loadProjectById } from "../../resources";
import {
  denialFor,
  permissionProcedure,
  type OrganizationContext,
} from "../../trpc";

export const uuid = z.string().uuid();

export const channelName = z
  .string()
  .trim()
  .min(1, "Give the channel a name.")
  .max(80, "Keep the name under 80 characters.")
  .transform(normalizeChannelName)
  .refine((name) => name.length >= 2, "Use at least 2 letters or numbers.")
  .refine(
    (name) =>
      ![
        "mentions",
        "search",
        "dm",
        "new",
        "browse",
        "saved",
        "threads",
        "drafts",
        "catch-up",
      ].includes(name),
    "That name is reserved.",
  );

export const link = z
  .object({ type: z.enum(["team", "project"]), id: uuid })
  .nullable();

export const chatProcedure = (
  permission: string,
  options: { audit?: string[]; also?: string[] } = {},
) => permissionProcedure(permission, undefined, { module: "chat", ...options });

/** Team or project a channel is linked to, checked against the caller. */
export async function resolveLink(
  ctx: OrganizationContext,
  value: { type: "team" | "project"; id: string } | null | undefined,
) {
  if (!value) return null;

  if (value.type === "project") {
    const project = await loadProjectById(ctx, value.id);

    if (!project) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
    }

    const decision = await ctx.permissions.check("projects.view", { project });

    if (!decision.allowed) throw denialFor(decision);

    return value;
  }

  const [team] = await ctx.db
    .select({ id: teams.id })
    .from(teams)
    .where(
      and(
        eq(teams.id, value.id),
        eq(teams.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!team) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
  }

  return value;
}

/** Names and keys of the teams and projects channels are linked to. */
export async function linkLabels(
  ctx: OrganizationContext,
  rows: Array<{ linkType: string | null; linkId: string | null }>,
) {
  const projectIds = rows
    .filter((row) => row.linkType === "project" && row.linkId)
    .map((row) => row.linkId!);
  const teamIds = rows
    .filter((row) => row.linkType === "team" && row.linkId)
    .map((row) => row.linkId!);
  const taskIds = rows
    .filter((row) => row.linkType === "task" && row.linkId)
    .map((row) => row.linkId!);
  const docIds = rows
    .filter((row) => row.linkType === "doc" && row.linkId)
    .map((row) => row.linkId!);

  const [taskProjects, projectProjects, docsVisible] = await Promise.all([
    taskIds.length
      ? ctx.permissions.viewableProjectIds("tasks.view")
      : Promise.resolve([] as string[]),
    projectIds.length
      ? ctx.permissions.viewableProjectIds("projects.view")
      : Promise.resolve([] as string[]),
    docIds.length
      ? visibleDocsCondition(ctx.permissions, "docs.view")
      : Promise.resolve(null),
  ]);

  const [taskRows, docRows] = await Promise.all([
    taskIds.length && taskProjects.length
      ? ctx.db
          .select({ id: tasks.id, name: tasks.name, key: tasks.key })
          .from(tasks)
          .where(
            and(
              inArray(tasks.id, taskIds),
              inArray(tasks.projectId, taskProjects),
            ),
          )
      : [],
    docIds.length && docsVisible
      ? ctx.db
          .select({ id: docs.id, title: docs.title, slug: docs.slug })
          .from(docs)
          .where(and(inArray(docs.id, docIds), docsVisible))
      : [],
  ]);

  const [projectRows, teamRows] = await Promise.all([
    projectIds.length && projectProjects.length
      ? ctx.db
          .select({
            id: projects.id,
            name: projects.name,
            key: projects.taskKeyPrefix,
            slug: projects.slug,
          })
          .from(projects)
          .where(
            and(
              inArray(projects.id, projectIds),
              inArray(projects.id, projectProjects),
            ),
          )
      : [],
    teamIds.length
      ? ctx.db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : [],
  ]);

  return (linkType: string | null, linkId: string | null) => {
    if (linkType === "task") {
      const task = taskRows.find((entry) => entry.id === linkId);

      return task
        ? {
            type: "task" as const,
            id: task.id,
            name: task.name,
            key: task.key,
            href: `/tasks/${task.key}`,
          }
        : null;
    }

    if (linkType === "doc") {
      const doc = docRows.find((entry) => entry.id === linkId);

      return doc
        ? {
            type: "doc" as const,
            id: doc.id,
            name: doc.title || "Untitled",
            key: null,
            href: `/docs/${doc.slug}`,
          }
        : null;
    }

    if (linkType === "project") {
      const project = projectRows.find((entry) => entry.id === linkId);

      return project
        ? {
            type: "project" as const,
            id: project.id,
            name: project.name,
            key: project.key,
            href: `/projects/${project.slug}`,
          }
        : null;
    }

    if (linkType === "team") {
      const team = teamRows.find((entry) => entry.id === linkId);

      return team
        ? {
            type: "team" as const,
            id: team.id,
            name: team.name,
            key: null,
            href: `/settings/organization/teams/${team.id}`,
          }
        : null;
    }

    return null;
  };
}

export async function addMembersHelper(
  ctx: OrganizationContext,
  channelId: string,
  memberIds: string[],
  role: "admin" | "member" = "member",
) {
  if (!memberIds.length) return [];

  const valid = await memberProfiles(ctx, memberIds);

  if (!valid.size) return [];

  return ctx.db
    .insert(chatMembers)
    .values(
      [...valid.keys()].map((memberId) => ({ channelId, memberId, role })),
    )
    .onConflictDoNothing()
    .returning({ memberId: chatMembers.memberId });
}

/** Turns "Arjun, Sana and Diego" style DM titles out of the other people. */
export function dmTitle(names: string[]) {
  if (!names.length) return "Just you";
  if (names.length <= 3) return names.join(", ");

  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}
