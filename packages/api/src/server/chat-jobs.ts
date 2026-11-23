import { and, eq, isNull, lte, sql } from "@kyren/db/drizzle";
import {
  chatChannels,
  chatMembers,
  chatMessages,
  chatSaved,
  chatScheduled,
} from "@kyren/db/schema";

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
import { purgeDeletedFiles, retireUnsentMailFiles } from "./file-purge";
import { purgeScheduledOrganizations } from "./platform-purge";
import { applyRetention, purgeExpired } from "./retention";
import { deliverDueWebhooks } from "./webhooks";

type Db = DbHandle & {
  transaction: <T>(run: (tx: DbHandle) => Promise<T>) => Promise<T>;
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

/** Sends scheduled messages whose time has come. */
export async function sendDueScheduled(db: Db, organizationId?: string) {
  const due = await db
    .select()
    .from(chatScheduled)
    .where(
      and(
        lte(chatScheduled.sendAt, new Date()),
        isNull(chatScheduled.sentAt),
        isNull(chatScheduled.canceledAt),
        organizationId
          ? eq(chatScheduled.organizationId, organizationId)
          : undefined,
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
export async function markDueReminders(db: Db, organizationId?: string) {
  const rows = await db
    .update(chatSaved)
    .set({ remindedAt: new Date() })
    .where(
      and(
        lte(chatSaved.remindAt, new Date()),
        isNull(chatSaved.remindedAt),
        isNull(chatSaved.completedAt),
        organizationId
          ? sql`${chatSaved.memberId} in (select "id" from "member" where "organizationId" = ${organizationId})`
          : undefined,
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
    /** Only this organization's due work (a page load); the heavy sweeps never run then. */
    organizationId?: string;
  } = {},
) {
  const { organizationId } = options;
  const heavy = options.heavy && !organizationId;
  const sent = await sendDueScheduled(db, organizationId);
  const reminded = await markDueReminders(db, organizationId);

  // Retention and overdue sweeps are the expensive ones; the daily cron
  // asks for them, page loads do not.
  const purged = heavy ? (await applyRetention(db as never)).chatMessages : 0;
  const overdue = heavy ? await postOverdueEvents(db) : 0;

  const tenantsPurged = heavy
    ? await purgeScheduledOrganizations(db as never, {
        removeFiles: options.removeFiles,
      })
    : 0;
  const mailFilesRetired = heavy ? await retireUnsentMailFiles(db as never) : 0;
  const filesPurged = heavy
    ? await purgeDeletedFiles(db as never, {
        removeFiles: options.removeFiles,
      })
    : 0;
  const meetingReminders = await sendDueMeetingReminders(db, organizationId);
  const recurring = await createDueRecurringTasks(
    db,
    new Date(),
    organizationId,
  );
  const queued = await runDueJobs(db as never);
  let escalated = 0;

  if (heavy) {
    for (const dueOrganization of await organizationsWithDueRules(db)) {
      escalated += (
        await escalateDueTasks(db, { organizationId: dueOrganization })
      ).length;
    }
  }

  // Webhook deliveries ride along with the same schedule.
  const webhooks = await deliverDueWebhooks(
    db as unknown as Parameters<typeof deliverDueWebhooks>[0],
    { organizationId },
  );

  return {
    sent,
    reminded,
    purged,
    tenantsPurged,
    filesPurged,
    mailFilesRetired,
    overdue,
    escalated,
    meetingReminders,
    recurring,
    queued,
    webhooks,
  };
}

/** When each organization's due work last ran from a page load, on this server. */
const lastLazyRun = new Map<string, number>();
/** Key for the light pass over every organization. */
const EVERYONE = "*";

/**
 * A cheap run from a page load: the caller's organization at most once a
 * minute, and the light work of every organization (scheduled messages,
 * reminders, queued jobs) at most once every five minutes per server. The
 * daily cron only does the heavy sweeps, so without that second pass an
 * organization nobody has open would get its reminders hours late.
 */
export async function runChatJobsLazily(db: Db, organizationId: string) {
  // Tests run the jobs themselves; a page load in one test file must not send
  // another file's reminders or scheduled messages (like the other lazy runs).
  if (process.env.VITEST) return;

  const now = Date.now();
  const everyone = now - (lastLazyRun.get(EVERYONE) ?? 0) >= 5 * 60_000;

  if (!everyone && now - (lastLazyRun.get(organizationId) ?? 0) < 60_000) {
    return;
  }

  lastLazyRun.set(organizationId, now);

  if (everyone) lastLazyRun.set(EVERYONE, now);

  try {
    await runChatJobs(db, everyone ? {} : { organizationId });
  } catch (error) {
    console.error("[chat] background jobs failed", error);
  }
}

export { purgeExpired };
