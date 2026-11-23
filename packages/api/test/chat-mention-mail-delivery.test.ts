import { db } from "@kyren/db";
import { and, eq, sql } from "@kyren/db/drizzle";
import {
  chatMessages,
  chatScheduled,
  organizationModules,
} from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runChatJobs } from "../src/server/chat-jobs";
import {
  deliverMentionEmail,
  setMentionMailer,
  type MentionMail,
} from "../src/server/chat-mention-mail";
import {
  queuedMentionJob,
  setupChatMentionTest,
} from "./helpers/chat-mention-helpers";
import { World } from "./helpers";

const world = new World();
const sent: MentionMail[] = [];

afterAll(async () => {
  setMentionMailer(null);
  await world.cleanup();
});

type Context = Awaited<ReturnType<typeof setupChatMentionTest>>;

describe("chat mention emails delivery", () => {
  let ctx: Context;

  beforeAll(async () => {
    setMentionMailer(async (mail) => {
      sent.push(mail);
    });
    ctx = await setupChatMentionTest(world, sent);
  });

  it("queues an email for later and sends it if the person hasn't read it", async () => {
    sent.length = 0;

    const message = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: `<@${ctx.arjunId}> can you check the rollout?`,
    });
    const [job] = await queuedMentionJob(message.id);

    expect(job!.payload).toEqual({
      messageId: message.id,
      memberId: ctx.arjunId,
      namedAt: expect.any(String),
    });
    expect(job!.runAt.getTime()).toBeGreaterThan(Date.now() + 5 * 60_000);

    expect(
      await deliverMentionEmail(db, {
        messageId: message.id,
        memberId: ctx.arjunId,
      }),
    ).toBe("sent");
    expect(sent[0]).toMatchObject({
      author: "Priya Raman",
      conversation: `#${ctx.channel.name}`,
      excerpt: "@Arjun Mehta can you check the rollout?",
      path: `/chat/${ctx.channel.name}`,
    });
  });

  it("stays quiet once they have read it, or turned these emails off", async () => {
    const message = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: `<@${ctx.arjunId}> seen this?`,
    });

    await ctx.arjun.chat.markRead({ channelId: ctx.channel.id });
    expect(
      await deliverMentionEmail(db, {
        messageId: message.id,
        memberId: ctx.arjunId,
      }),
    ).toBe("read");

    const later = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: `<@${ctx.arjunId}> and this?`,
    });

    await ctx.arjun.notification.setPreferences({
      mutedKinds: ["mention_email"],
    });
    expect(
      await deliverMentionEmail(db, {
        messageId: later.id,
        memberId: ctx.arjunId,
      }),
    ).toBe("off");
  });

  it("never emails a whole channel, outsiders to a private one, or deleted messages", async () => {
    const everyone = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: "<!channel> release is out",
    });

    expect(await queuedMentionJob(everyone.id)).toEqual([]);

    const secret = await ctx.priya.chat.create({
      name: `exec-${Date.now()}`,
      visibility: "private",
    });
    const hidden = await ctx.priya.chat.send({
      channelId: secret.id,
      body: `<@${ctx.meeraId}> board notes`,
    });

    expect(
      await deliverMentionEmail(db, {
        messageId: hidden.id,
        memberId: ctx.meeraId,
      }),
    ).toBe("unreadable");

    const removed = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: `<@${ctx.arjunId}> never mind`,
    });

    await db
      .update(chatMessages)
      .set({ deletedAt: new Date() })
      .where(eq(chatMessages.id, removed.id));
    expect(
      await deliverMentionEmail(db, {
        messageId: removed.id,
        memberId: ctx.arjunId,
      }),
    ).toBe("gone");

    const self = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: `<@${ctx.priyaId}> note to self`,
    });

    expect(await queuedMentionJob(self.id)).toEqual([]);
  });

  it("queues the email when a scheduled message goes out", async () => {
    await ctx.priya.chat.schedule({
      channelId: ctx.channel.id,
      body: `<@${ctx.arjunId}> reminder: demo at 3`,
      sendAt: new Date(Date.now() + 120_000),
    });
    await db
      .update(chatScheduled)
      .set({ sendAt: new Date(Date.now() - 1000) })
      .where(eq(chatScheduled.organizationId, ctx.org.id));
    await runChatJobs(db as never, { organizationId: ctx.org.id });

    const [posted] = await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.channelId, ctx.channel.id),
          sql`${chatMessages.body} like '%reminder: demo at 3%'`,
        ),
      );

    expect(await queuedMentionJob(posted!.id)).toHaveLength(1);
  });

  it("never emails people whose role can't read chat, or once chat is off", async () => {
    const guest = await world.userIn(ctx.org, "member", "Guest Gupta");

    await world.override(ctx.org, guest.user, "chat.view", "deny");

    const open = await ctx.priya.chat.create({
      name: `public-${Date.now()}`,
      visibility: "public",
    });
    const guestNote = await ctx.priya.chat.send({
      channelId: open.id,
      body: `<@${guest.member.id}> pricing draft`,
    });

    expect(
      await deliverMentionEmail(db, {
        messageId: guestNote.id,
        memberId: guest.member.id,
      }),
    ).toBe("unreadable");

    const arjunNote = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: `<@${ctx.arjunId}> before chat goes off`,
    });

    await db.insert(organizationModules).values({
      organizationId: ctx.org.id,
      moduleId: "chat",
      enabled: false,
    });

    try {
      expect(
        await deliverMentionEmail(db, {
          messageId: arjunNote.id,
          memberId: ctx.arjunId,
        }),
      ).toBe("unreadable");
    } finally {
      await db
        .delete(organizationModules)
        .where(
          and(
            eq(organizationModules.organizationId, ctx.org.id),
            eq(organizationModules.moduleId, "chat"),
          ),
        );
    }
  });
});
