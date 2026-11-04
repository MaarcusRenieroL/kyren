import { and, eq, isNull, lte, sql } from "@zentro/db/drizzle";
import {
  chatChannels,
  chatMembers,
  chatMessages,
  chatSaved,
  chatScheduled,
} from "@zentro/db/schema";

import type { DbHandle } from "./access";
import {
  escalateDueTasks,
  organizationsWithDueRules,
} from "./automations/due-escalation";
import { postOverdueEvents } from "./chat-events";
import { postChatMessage } from "./chat-post";
import { sendDueMeetingReminders } from "./meeting-reminders";
import { createDueRecurringTasks } from "./recurring-tasks";
import { runDueJobs } from "./jobs";
import { purgeScheduledOrganizations } from "./platform-purge";
import { applyRetention, purgeExpired } from "./retention";
import { deliverDueWebhooks } from "./webhooks";

type Db = DbHandle & {
  transaction: <T>(run: (tx: DbHandle) => Promise<T>) => Promise<T>;
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

/** Sends scheduled messages whose time has come. */
export async function sendDueScheduled(db: Db) {
  const due = await db
    .select()
    .from(chatScheduled)
    .where(
      and(
        lte(chatScheduled.sendAt, new Date()),
        isNull(chatScheduled.sentAt),
        isNull(chatScheduled.canceledAt),
      ),
    )
    .limit(50);
  let sent = 0;

  for (const item of due) {
    // Claim it first so two runs never send it twice.
    const claimed = await db
      .update(chatScheduled)
      .set({ sentAt: new Date() })
      .where(and(eq(chatScheduled.id, item.id), isNull(chatScheduled.sentAt)))
      .returning({ id: chatScheduled.id });

    if (!claimed.length) continue;

    const [channel] = await db
      .select({
        id: chatChannels.id,
        kind: chatChannels.kind,
        visibility: chatChannels.visibility,
        archivedAt: chatChannels.archivedAt,
      })
      .from(chatChannels)
      .where(eq(chatChannels.id, item.channelId))
      .limit(1);
    const [membership] = await db
      .select({ id: chatMembers.id })
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.channelId, item.channelId),
          eq(chatMembers.memberId, item.memberId),
        ),
      )
      .limit(1);
    const open =
      channel &&
      !channel.archivedAt &&
      (membership ||
        (channel.kind === "channel" && channel.visibility === "public"));

    if (!open) {
      // The channel went away or closed to them; do not send into it.
      await db
        .update(chatScheduled)
        .set({ sentAt: null, canceledAt: new Date() })
        .where(eq(chatScheduled.id, item.id));

      continue;
    }

    await postChatMessage(db, {
      organizationId: item.organizationId,
      channelId: item.channelId,
      memberId: item.memberId,
      parentId: item.parentId,
      body: item.body,
      join: !membership,
    });
    sent += 1;
  }

  return sent;
}

/** Marks due reminders so each is surfaced once. */
export async function markDueReminders(db: Db) {
  const rows = await db
    .update(chatSaved)
    .set({ remindedAt: new Date() })
    .where(
      and(
        lte(chatSaved.remindAt, new Date()),
        isNull(chatSaved.remindedAt),
        isNull(chatSaved.completedAt),
      ),
    )
    .returning({ id: chatSaved.id });

  return rows.length;
}

/** Everything chat does in the background. Safe to run often. */
export async function runChatJobs(
  db: Db,
  options: {
    heavy?: boolean;
    /** Deletes uploaded bytes by storage key; the web app supplies its storage driver. */
    removeFiles?: (keys: string[]) => Promise<void>;
  } = {},
) {
  const sent = await sendDueScheduled(db);
  const reminded = await markDueReminders(db);

  // Retention and overdue sweeps are the expensive ones; the daily cron
  // asks for them, page loads do not.
  const purged = options.heavy
    ? (await applyRetention(db as never)).chatMessages
    : 0;
  const overdue = options.heavy ? await postOverdueEvents(db) : 0;

  const tenantsPurged = options.heavy
    ? await purgeScheduledOrganizations(db as never, {
        removeFiles: options.removeFiles,
      })
    : 0;
  const meetingReminders = await sendDueMeetingReminders(db);
  const recurring = await createDueRecurringTasks(db);
  const queued = await runDueJobs(db as never);
  let escalated = 0;

  if (options.heavy) {
    for (const organizationId of await organizationsWithDueRules(db)) {
      escalated += (await escalateDueTasks(db, { organizationId })).length;
    }
  }

  // Webhook deliveries ride along with the same schedule.
  const webhooks = await deliverDueWebhooks(
    db as unknown as Parameters<typeof deliverDueWebhooks>[0],
  );

  return {
    sent,
    reminded,
    purged,
    tenantsPurged,
    overdue,
    escalated,
    meetingReminders,
    recurring,
    queued,
    webhooks,
  };
}

let lastLazyRun = 0;

/** A cheap run from a page load, at most once a minute per server. */
export async function runChatJobsLazily(db: Db) {
  if (Date.now() - lastLazyRun < 60_000) return;

  lastLazyRun = Date.now();

  try {
    await runChatJobs(db);
  } catch (error) {
    console.error("[chat] background jobs failed", error);
  }
}

export { purgeExpired };
