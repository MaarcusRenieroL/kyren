import { and, desc, eq, sql } from "@zentro/db/drizzle";
import {
  automations,
  chatChannels,
  projects,
  tasks,
  workLinks,
} from "@zentro/db/schema";
import { postFromAutomation } from "./post-helper";
import type { MessageContext } from "./types";

/**
 * Runs the rules that watch chat: "a message contains ...", with an optional
 * channel, then either posts a note or makes a task from the message.
 * Never throws; chat must not break because a rule did.
 */
export async function runMessageAutomations({
  db,
  organizationId,
  message,
}: MessageContext) {
  try {
    const rules = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.organizationId, organizationId),
          eq(automations.enabled, true),
          eq(automations.triggerEvent, "chat.message_contains"),
        ),
      );
    const text = message.body.toLowerCase();

    for (const rule of rules) {
      const trigger = (rule.triggerConfig ?? {}) as Record<string, any>;
      const action = (rule.actionConfig ?? {}) as Record<string, any>;
      const needle = String(trigger.contains ?? "")
        .trim()
        .toLowerCase();

      if (!needle || !text.includes(needle)) continue;
      if (trigger.channelId && trigger.channelId !== message.channelId)
        continue;
      // A rule that names no channel watches public ones only, so it cannot
      // be used to read private conversations or direct messages.
      if (!trigger.channelId && !(await isPublicChannel(db, message.channelId)))
        continue;

      let ran = false;

      if (rule.actionType === "post_to_channel" && action.channelId) {
        ran = await postFromAutomation(db, {
          organizationId,
          channelId: action.channelId,
          actorMemberId: message.authorMemberId,
          text: `Automation “${rule.name}” matched a message in another conversation.`,
        });
      } else if (rule.actionType === "create_task") {
        const projectId = rule.projectId ?? action.projectId;

        if (!projectId || !message.authorMemberId) continue;

        const task = await createTaskFromMessage(db, {
          organizationId,
          projectId,
          memberId: message.authorMemberId,
          message,
        });

        if (task) {
          ran = true;
          await postFromAutomation(db, {
            organizationId,
            channelId: message.channelId,
            actorMemberId: message.authorMemberId,
            parentId: message.parentId ?? message.id,
            text: `created ${task.key} from this message (automation “${rule.name}”)`,
          });
        }
      }

      if (ran) {
        await db
          .update(automations)
          .set({
            runCount: sql`${automations.runCount} + 1`,
            lastRunAt: new Date(),
          })
          .where(eq(automations.id, rule.id));
      }
    }
  } catch (error) {
    console.error("Chat automation error:", error);
  }
}

async function isPublicChannel(db: any, channelId: string) {
  const [channel] = await db
    .select({ kind: chatChannels.kind, visibility: chatChannels.visibility })
    .from(chatChannels)
    .where(eq(chatChannels.id, channelId))
    .limit(1);

  return channel?.kind === "channel" && channel.visibility === "public";
}

async function createTaskFromMessage(
  db: any,
  input: {
    organizationId: string;
    projectId: string;
    memberId: string;
    message: MessageContext["message"];
  },
) {
  return db.transaction(async (tx: any) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${input.projectId}, 0))`,
    );

    const [project] = await tx
      .select({
        id: projects.id,
        teamId: projects.teamId,
        prefix: projects.taskKeyPrefix,
      })
      .from(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    if (!project) return null;

    const [latest] = await tx
      .select({ taskNumber: tasks.taskNumber })
      .from(tasks)
      .where(eq(tasks.projectId, project.id))
      .orderBy(desc(tasks.taskNumber))
      .limit(1);
    const taskNumber = (latest?.taskNumber ?? 0) + 1;
    const name = input.message.body
      .replace(/<@[0-9a-f-]{36}>/g, "")
      .replace(/<!(?:channel|here)>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
    const [task] = await tx
      .insert(tasks)
      .values({
        organizationId: input.organizationId,
        projectId: project.id,
        teamId: project.teamId,
        key: `${project.prefix}-${taskNumber}`,
        taskNumber,
        name: name || "Task from chat",
        createdByMemberId: input.memberId,
      })
      .returning({ id: tasks.id, key: tasks.key });

    await tx.insert(workLinks).values({
      organizationId: input.organizationId,
      sourceType: "message",
      sourceId: input.message.id,
      targetType: "task",
      targetId: task.id,
      kind: "relates",
      createdByMemberId: input.memberId,
    });

    return task as { id: string; key: string };
  });
}
