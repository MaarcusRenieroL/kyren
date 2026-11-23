import { db as database } from "@kyren/db";
import { and, eq, inArray, isNull, sql } from "@kyren/db/drizzle";
import {
  chatChannels,
  chatMembers,
  chatMessages,
  jobs,
  members,
  notificationPreferences,
  users,
} from "@kyren/db/schema";

import { mentionedMemberIds, plainBody } from "./chat";
import { enqueueJob, registerJobHandler } from "./jobs";
import { loadEnabledModules } from "./modules";
import { createPermissionContext } from "./permissions";
import { organizationStatus } from "./platform-policy";

type Db = typeof database;

/** How long someone has to read a mention in the app before it is emailed. */
export const MENTION_EMAIL_DELAY_MS = 10 * 60 * 1000;

/** The kind someone mutes to stop these emails. */
export const MENTION_EMAIL_KIND = "mention_email";

export type MentionMail = {
  to: string;
  author: string;
  conversation: string;
  excerpt: string;
  path: string;
};

type Mailer = (mail: MentionMail) => Promise<void>;

let override: Mailer | null = null;

/** Replaces how mail is sent (tests); null goes back to the real thing. */
export function setMentionMailer(mailer: Mailer | null) {
  override = mailer;
}

async function send(mail: MentionMail) {
  if (override) return override(mail);
  // Reserved test addresses never receive real mail.
  if (mail.to.toLowerCase().endsWith(".test")) return;

  const { sendChatMentionEmail } = await import("@kyren/auth");

  await sendChatMentionEmail(mail);
}

/**
 * Queues an email for each person named in a message, to go out after a
 * delay. `@channel` and `@here` never email, so one message can't mail a
 * whole channel.
 */
export async function queueMentionEmails(
  db: Pick<Db, "insert" | "select">,
  message: { id: string; authorMemberId: string | null; body: string },
  /** People already named before an edit, who were queued then. */
  alreadyNamed: string[] = [],
) {
  const now = new Date();
  const runAt = new Date(now.getTime() + MENTION_EMAIL_DELAY_MS);

  for (const memberId of mentionedMemberIds(message.body)) {
    if (memberId === message.authorMemberId) continue;
    if (alreadyNamed.includes(memberId)) continue;

    // Named, taken out and named again by edits: one email is still enough.
    const [waiting] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.kind, "chat_mention_mail"),
          eq(jobs.status, "pending"),
          sql`${jobs.payload} ->> 'messageId' = ${message.id}`,
          sql`${jobs.payload} ->> 'memberId' = ${memberId}`,
        ),
      )
      .limit(1);

    if (waiting) continue;

    await enqueueJob(
      db,
      "chat_mention_mail",
      // When they were named: reading the channel before then doesn't count.
      { messageId: message.id, memberId, namedAt: now.toISOString() },
      { runAt, maxAttempts: 3 },
    );
  }
}

/**
 * Sends one queued mention email, unless by now the message is gone, the
 * person can't read the conversation, has read it since, muted it, or turned
 * these emails off.
 */
export async function deliverMentionEmail(
  db: Db,
  payload: { messageId: string; memberId: string; namedAt?: string },
) {
  const [row] = await db
    .select({ message: chatMessages, channel: chatChannels })
    .from(chatMessages)
    .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
    .where(
      and(
        eq(chatMessages.id, payload.messageId),
        isNull(chatMessages.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return "gone";

  const { message, channel } = row;

  // A suspended organization sends nothing out.
  if ((await organizationStatus(db, message.organizationId)).suspended) {
    return "suspended";
  }

  // An edit that took the name out takes the email back too.
  if (!mentionedMemberIds(message.body).includes(payload.memberId)) {
    return "unmentioned";
  }

  const [person] = await db
    .select({ userId: members.userId, email: users.email })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(members.id, payload.memberId),
        eq(members.organizationId, message.organizationId),
      ),
    )
    .limit(1);

  if (!person) return "left";

  // Same rule as reading chat in the app: the module is on and their role
  // may view chat.
  if (
    !(await loadEnabledModules(db, message.organizationId)).has("chat") ||
    !(await createPermissionContext(
      db as never,
      message.organizationId,
      person.userId,
    ).can("chat.view"))
  ) {
    return "unreadable";
  }

  const [membership] = await db
    .select({ lastReadAt: chatMembers.lastReadAt, notify: chatMembers.notify })
    .from(chatMembers)
    .where(
      and(
        eq(chatMembers.channelId, channel.id),
        eq(chatMembers.memberId, payload.memberId),
      ),
    )
    .limit(1);

  // Private channels and direct messages are for their members only.
  if (
    !membership &&
    (channel.visibility !== "public" || channel.kind === "dm")
  ) {
    return "unreadable";
  }

  if (membership?.notify === "mute") return "muted";
  // Read since they were named (an edit can name someone later).
  const namedAt = payload.namedAt
    ? new Date(payload.namedAt)
    : message.createdAt;

  if (membership && membership.lastReadAt >= namedAt) return "read";

  const [preferences] = await db
    .select({ mutedKinds: notificationPreferences.mutedKinds })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.organizationId, message.organizationId),
        eq(notificationPreferences.userId, person.userId),
      ),
    )
    .limit(1);

  if (preferences?.mutedKinds.includes(MENTION_EMAIL_KIND)) return "off";

  const [author] = message.authorMemberId
    ? await db
        .select({ name: users.name })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(
          and(
            eq(members.id, message.authorMemberId),
            eq(members.organizationId, message.organizationId),
          ),
        )
        .limit(1)
    : [];
  const named = mentionedMemberIds(message.body);
  const names = new Map(
    named.length
      ? (
          await db
            .select({ id: members.id, name: users.name })
            .from(members)
            .innerJoin(users, eq(users.id, members.userId))
            .where(
              and(
                inArray(members.id, named),
                eq(members.organizationId, message.organizationId),
              ),
            )
        ).map((entry) => [entry.id, entry.name])
      : [],
  );
  const text = plainBody(message.body, names);

  await send({
    to: person.email,
    author: author?.name ?? "Someone",
    conversation:
      channel.kind === "dm" ? "a direct message" : `#${channel.name}`,
    excerpt: text.length > 280 ? `${text.slice(0, 277)}…` : text,
    path:
      channel.kind === "dm"
        ? `/chat/dm/${channel.id}`
        : `/chat/${channel.name}`,
  });

  return "sent";
}

registerJobHandler("chat_mention_mail", async (payload) => {
  await deliverMentionEmail(
    database,
    payload as { messageId: string; memberId: string; namedAt?: string },
  );
});
