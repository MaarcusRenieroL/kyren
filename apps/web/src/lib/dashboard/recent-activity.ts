import {
  createPermissionContext,
  visibleActivityCondition,
} from "@kyren/api/server";
import { actorName, describeEvent } from "@kyren/audit";
import { db } from "@kyren/db";
import { and, desc, eq } from "@kyren/db/drizzle";
import { activityEvents, users } from "@kyren/db/schema";
import type { ModuleId } from "@kyren/modules";
import { paths } from "~/src/lib/paths";
import {
  formatRelativeDate,
  getInitials,
  type DashboardActivityItem,
  type Viewer,
} from "./types";

/** Overview's recent activity: the latest events the caller may see. */
export async function getRecentActivity({
  organizationId,
  userId,
  enabledModules,
  timeZone,
}: Omit<Viewer, "snapshot">): Promise<DashboardActivityItem[]> {
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
