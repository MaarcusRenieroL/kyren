import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  sql,
} from "@kyren/db/drizzle";
import { activityEvents, automations, tasks } from "@kyren/db/schema";

import { taskPrioritySchema } from "../../types/zod-schema";
import type { DbHandle } from "../access";

const DEFAULT_WITHIN_HOURS = 24;
const MAX_WITHIN_HOURS = 24 * 90;

/**
 * Applies the organisation's enabled "due date approaching" rules: an open
 * task due within the rule's window (or already late) gets the rule's priority.
 * Nothing changes without such a rule. `projectIds` narrows it to projects the
 * caller may change; the scheduled run passes none and covers the whole
 * organisation. Each change is recorded as the system acting, and a task that
 * already has the priority is left alone, so running it again does nothing.
 */
export async function escalateDueTasks(
  db: DbHandle,
  options: {
    organizationId: string;
    projectIds?: string[];
    now?: Date;
  },
) {
  const now = options.now ?? new Date();
  const rules = await db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.organizationId, options.organizationId),
        eq(automations.enabled, true),
        eq(automations.triggerEvent, "task.due_date_approaching"),
        eq(automations.actionType, "set_priority"),
      ),
    );
  const changed = new Map<string, { id: string; key: string; name: string }>();

  for (const rule of rules) {
    const priority = taskPrioritySchema.safeParse(
      (rule.actionConfig as Record<string, unknown> | null)?.priority,
    );

    if (!priority.success) continue;

    const hoursSetting = Number(
      (rule.triggerConfig as Record<string, unknown> | null)?.withinHours,
    );
    const hours =
      Number.isFinite(hoursSetting) && hoursSetting > 0
        ? Math.min(hoursSetting, MAX_WITHIN_HOURS)
        : DEFAULT_WITHIN_HOURS;
    const horizon = new Date(now.getTime() + hours * 3_600_000);
    const open = await db
      .select({
        id: tasks.id,
        key: tasks.key,
        name: tasks.name,
        priority: tasks.priority,
        projectId: tasks.projectId,
        teamId: tasks.teamId,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, options.organizationId),
          rule.projectId ? eq(tasks.projectId, rule.projectId) : undefined,
          options.projectIds
            ? inArray(tasks.projectId, options.projectIds)
            : undefined,
          isNull(tasks.deletedAt),
          isNull(tasks.archivedAt),
          ne(tasks.status, "done"),
          isNotNull(tasks.dueAt),
          lte(tasks.dueAt, horizon),
          ne(tasks.priority, priority.data),
        ),
      );
    let count = 0;

    for (const task of open) {
      // Claim the change in the same statement, so two runs never both apply it.
      const updated = await db
        .update(tasks)
        .set({ priority: priority.data, updatedAt: new Date() })
        .where(and(eq(tasks.id, task.id), ne(tasks.priority, priority.data)))
        .returning({ id: tasks.id });

      if (!updated.length) continue;

      await db.insert(activityEvents).values({
        organizationId: options.organizationId,
        actorUserId: null,
        action: "task.updated",
        targetType: "task",
        targetId: task.id,
        targetLabel: task.key,
        projectId: task.projectId,
        teamId: task.teamId,
        metadata: {
          name: task.name,
          automation: rule.name,
          changes: [
            { field: "priority", from: task.priority, to: priority.data },
          ],
        },
      });
      changed.set(task.id, { id: task.id, key: task.key, name: task.name });
      count += 1;
    }

    if (count > 0) {
      await db
        .update(automations)
        .set({
          runCount: sql`${automations.runCount} + ${count}`,
          lastRunAt: new Date(),
        })
        .where(eq(automations.id, rule.id));
    }
  }

  return [...changed.values()];
}

/** Every organisation that has such a rule on, for the scheduled sweep. */
export async function organizationsWithDueRules(db: DbHandle) {
  const rows = await db
    .select({ organizationId: automations.organizationId })
    .from(automations)
    .where(
      and(
        eq(automations.enabled, true),
        eq(automations.triggerEvent, "task.due_date_approaching"),
      ),
    )
    .groupBy(automations.organizationId);

  return rows.map((row) => row.organizationId);
}
