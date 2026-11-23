import { eq } from "drizzle-orm";
import { db } from "../../client/index";
import * as schema from "../../schema";
import { when, type SeedContext } from "./context";

export async function seedActivity(ctx: SeedContext) {
  const { orgId, members, websiteProject, mobileProject } = ctx;
  const { priya, daniel, meilin, tomas, sofia, jamal, ravi, hannah } = members;

  const allTasks = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.organizationId, orgId));

  // 18. Favorites & Task Activity Events
  await db
    .delete(schema.favorites)
    .where(eq(schema.favorites.organizationId, orgId));
  await db.insert(schema.favorites).values([
    {
      organizationId: orgId,
      userId: priya.userId,
      targetType: "project",
      targetId: websiteProject.id,
    },
    {
      organizationId: orgId,
      userId: priya.userId,
      targetType: "project",
      targetId: mobileProject.id,
    },
    {
      organizationId: orgId,
      userId: daniel.userId,
      targetType: "project",
      targetId: websiteProject.id,
    },
  ]);

  // Task Activity Events
  await db
    .delete(schema.taskActivityEvents)
    .where(eq(schema.taskActivityEvents.organizationId, orgId));
  for (let i = 0; i < 20; i++) {
    const t = allTasks[i % allTasks.length]!;
    const actor = [daniel, meilin, tomas, sofia, ravi][i % 5]!;
    await db.insert(schema.taskActivityEvents).values({
      organizationId: orgId,
      taskId: t.id,
      actorMemberId: actor.memberId,
      type: "status_changed",
      field: "status",
      fromValue: "todo",
      toValue: t.status,
      createdAt: when(-((i % 7) + 1)),
    });
  }


}
