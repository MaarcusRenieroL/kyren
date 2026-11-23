import { taskPrioritySchema, taskStatusSchema } from "../../types/zod-schema";
import { and, eq, sql } from "@kyren/db/drizzle";
import { automations, tasks } from "@kyren/db/schema";
import { postFromAutomation } from "./post-helper";
import type { EngineContext } from "./types";

export async function runTaskAutomations({
  db,
  organizationId,
  event,
  task,
  actorMemberId,
  previousStatus,
}: EngineContext) {
  try {
    // Find all active automations for this org matching this event
    const activeRules = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.organizationId, organizationId),
          eq(automations.enabled, true),
          eq(automations.triggerEvent, event),
        ),
      );

    if (!activeRules.length) return;

    const applyRule = async (rule: any) => {
      // Check project scoping
      if (rule.projectId && rule.projectId !== task.projectId) {
        return;
      }

      const trigConfig = (rule.triggerConfig ?? {}) as Record<string, any>;
      const actionConfig = (rule.actionConfig ?? {}) as Record<string, any>;
      let shouldExecute = false;

      if (event === "task.status_changed") {
        const matchesTo =
          !trigConfig.toStatus || trigConfig.toStatus === task.status;
        const matchesFrom =
          !trigConfig.fromStatus || trigConfig.fromStatus === previousStatus;
        shouldExecute = matchesTo && matchesFrom;
      } else if (event === "task.subtasks_all_done") {
        shouldExecute = true;
      } else if (
        event === "task.created" ||
        event === "task.blockers_resolved"
      ) {
        shouldExecute = true;
      }

      if (!shouldExecute) return;

      let executedAction = false;

      // Execute Action
      if (
        rule.actionType === "update_status" &&
        taskStatusSchema.safeParse(actionConfig.targetStatus).success
      ) {
        // If this was triggered because subtasks are all done, update the parent task!
        const targetTaskId =
          event === "task.subtasks_all_done" && task.parentTaskId
            ? task.parentTaskId
            : task.id;

        await db
          .update(tasks)
          .set({
            status: actionConfig.targetStatus,
            completedAt:
              actionConfig.targetStatus === "done" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, targetTaskId));
        executedAction = true;
      } else if (rule.actionType === "assign_actor" && actorMemberId) {
        // Assign to the actor if currently unassigned
        if (!task.assignedToMemberId) {
          await db
            .update(tasks)
            .set({ assignedToMemberId: actorMemberId, updatedAt: new Date() })
            .where(eq(tasks.id, task.id));
          executedAction = true;
        }
      } else if (
        rule.actionType === "set_priority" &&
        taskPrioritySchema.safeParse(actionConfig.priority).success
      ) {
        await db
          .update(tasks)
          .set({ priority: actionConfig.priority, updatedAt: new Date() })
          .where(eq(tasks.id, task.id));
        executedAction = true;
      } else if (
        rule.actionType === "post_to_channel" &&
        actionConfig.channelId
      ) {
        executedAction = await postFromAutomation(db, {
          organizationId,
          channelId: actionConfig.channelId,
          actorMemberId,
          text: `${task.key} · automation “${rule.name}” ran`,
        });
      }

      if (executedAction) {
        await db
          .update(automations)
          .set({
            runCount: sql`${automations.runCount} + 1`,
            lastRunAt: new Date(),
          })
          .where(eq(automations.id, rule.id));
      }
    };

    // One failing rule must not stop the others, and the log names it.
    for (const rule of activeRules) {
      try {
        await applyRule(rule);
      } catch (error) {
        console.error("Automation rule failed", {
          organizationId,
          ruleId: rule.id,
          ruleName: rule.name,
          event,
          error,
        });
      }
    }
  } catch (error) {
    // Non-blocking automation engine execution
    console.error("Automation engine error:", error);
  }
}
