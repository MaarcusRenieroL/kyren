import { db } from "@kyren/db";
import { inArray } from "@kyren/db/drizzle";
import {
  organizations,
  taskActivityEvents,
  taskComments,
  tasks,
  teamMembers,
  users,
} from "@kyren/db/schema";

export async function cleanupWorld(orgIds: string[], userIds: string[]) {
  if (orgIds.length) {
    const orgTasks = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(inArray(tasks.organizationId, orgIds));

    await db
      .delete(taskActivityEvents)
      .where(inArray(taskActivityEvents.taskId, orgTasks));
    await db
      .delete(taskComments)
      .where(inArray(taskComments.taskId, orgTasks));
    await db
      .delete(teamMembers)
      .where(inArray(teamMembers.organizationId, orgIds));
    await db
      .delete(organizations)
      .where(inArray(organizations.id, orgIds));
  }

  if (userIds.length) {
    await db.delete(users).where(inArray(users.id, userIds));
  }
}
