import { db } from "@zentro/db";
import { and, eq, sql } from "@zentro/db/drizzle";
import {
  chatMessages,
  chatScheduled,
  jobs,
  organizationModules,
  organizations,
} from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runChatJobs } from "../src/server/chat-jobs";
import {
  deliverMentionEmail,
  setMentionMailer,
  type MentionMail,
} from "../src/server/chat-mention-mail";
import { forgetOrganizationStatus } from "../src/server/platform-policy";
import { World } from "./helpers";

const world = new World();
const sent: MentionMail[] = [];

afterAll(async () => {
  setMentionMailer(null);
  await world.cleanup();
});

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("chat mention emails", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let priya: Caller;
  let arjun: Caller;
  let priyaId: string;
  let arjunId: string;
  let meeraId: string;
  let channel: { id: string; name: string };

  const queued = async (messageId: string) =>
    db
      .select({ payload: jobs.payload, runAt: jobs.runAt })
      .from(jobs)
      .where(
        and(
          eq(jobs.kind, "chat_mention_mail"),
          sql`${jobs.payload} ->> 'messageId' = ${messageId}`,
        ),
      );

  beforeAll(async () => {
    setMentionMailer(async (mail) => {
      sent.push(mail);
    });
    org = await world.org("Mention mail");
    const p = await world.userIn(org, "owner", "Priya Raman");
    const a = await world.userIn(org, "member", "Arjun Mehta");
    const m = await world.userIn(org, "member", "Meera Iyer");

    priya = await world.caller(p.user, org);
    arjun = await world.caller(a.user, org);
    priyaId = p.member.id;
    arjunId = a.member.id;
    meeraId = m.member.id;
    channel = await priya.chat.create({
      name: `launch-${Date.now()}`,
      memberIds: [arjunId],
    });
  });

  it("queues an email for later and sends it if the person hasn't read it", async () => {
    sent.length = 0;

    const message = await priya.chat.send({
      channelId: channel.id,
      body: `<@${arjunId}> can you check the rollout?`,
    });
    const [job] = await queued(message.id);

    expect(job!.payload).toEqual({
      messageId: message.id,
      memberId: arjunId,
      namedAt: expect.any(String),
    });
    expect(job!.runAt.getTime()).toBeGreaterThan(Date.now() + 5 * 60_000);

    expect(
      await deliverMentionEmail(db, {
        messageId: message.id,
        memberId: arjunId,
      }),
    ).toBe("sent");
    expect(sent[0]).toMatchObject({
      author: "Priya Raman",
      conversation: `#${channel.name}`,
      excerpt: "@Arjun Mehta can you check the rollout?",
      path: `/chat/${channel.name}`,
    });
  });

  it("stays quiet once they have read it, or turned these emails off", async () => {
    const message = await priya.chat.send({
      channelId: channel.id,
      body: `<@${arjunId}> seen this?`,
    });

    await arjun.chat.markRead({ channelId: channel.id });
    expect(
      await deliverMentionEmail(db, {
        messageId: message.id,
        memberId: arjunId,
      }),
    ).toBe("read");

    const later = await priya.chat.send({
      channelId: channel.id,
      body: `<@${arjunId}> and this?`,
    });

    await arjun.notification.setPreferences({ mutedKinds: ["mention_email"] });
    expect(
      await deliverMentionEmail(db, { messageId: later.id, memberId: arjunId }),
    ).toBe("off");
  });

  it("never emails a whole channel, outsiders to a private one, or deleted messages", async () => {
    const everyone = await priya.chat.send({
      channelId: channel.id,
      body: "<!channel> release is out",
    });

    expect(await queued(everyone.id)).toEqual([]);

    const secret = await priya.chat.create({
      name: `exec-${Date.now()}`,
      visibility: "private",
    });
    const hidden = await priya.chat.send({
      channelId: secret.id,
      body: `<@${meeraId}> board notes`,
    });

    expect(
      await deliverMentionEmail(db, {
        messageId: hidden.id,
        memberId: meeraId,
      }),
    ).toBe("unreadable");

    const removed = await priya.chat.send({
      channelId: channel.id,
      body: `<@${arjunId}> never mind`,
    });

    await db
      .update(chatMessages)
      .set({ deletedAt: new Date() })
      .where(eq(chatMessages.id, removed.id));
    expect(
      await deliverMentionEmail(db, {
        messageId: removed.id,
        memberId: arjunId,
      }),
    ).toBe("gone");
    // Mentioning yourself queues nothing.
    const self = await priya.chat.send({
      channelId: channel.id,
      body: `<@${priyaId}> note to self`,
    });

    expect(await queued(self.id)).toEqual([]);
  });

  it("queues the email when a scheduled message goes out", async () => {
    await priya.chat.schedule({
      channelId: channel.id,
      body: `<@${arjunId}> reminder: demo at 3`,
      sendAt: new Date(Date.now() + 120_000),
    });
    // Bring it forward and let this organization's jobs run.
    await db
      .update(chatScheduled)
      .set({ sendAt: new Date(Date.now() - 1000) })
      .where(eq(chatScheduled.organizationId, org.id));
    await runChatJobs(db as never, { organizationId: org.id });

    const [posted] = await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.channelId, channel.id),
          sql`${chatMessages.body} like '%reminder: demo at 3%'`,
        ),
      );

    expect(await queued(posted!.id)).toHaveLength(1);
  });

  it("never emails people whose role can't read chat, or once chat is off", async () => {
    const guest = await world.userIn(org, "member", "Guest Gupta");

    await world.override(org, guest.user, "chat.view", "deny");

    const open = await priya.chat.create({
      name: `public-${Date.now()}`,
      visibility: "public",
    });
    const guestNote = await priya.chat.send({
      channelId: open.id,
      body: `<@${guest.member.id}> pricing draft`,
    });

    expect(
      await deliverMentionEmail(db, {
        messageId: guestNote.id,
        memberId: guest.member.id,
      }),
    ).toBe("unreadable");

    const arjunNote = await priya.chat.send({
      channelId: channel.id,
      body: `<@${arjunId}> before chat goes off`,
    });

    await db.insert(organizationModules).values({
      organizationId: org.id,
      moduleId: "chat",
      enabled: false,
    });

    try {
      expect(
        await deliverMentionEmail(db, {
          messageId: arjunNote.id,
          memberId: arjunId,
        }),
      ).toBe("unreadable");
    } finally {
      await db
        .delete(organizationModules)
        .where(
          and(
            eq(organizationModules.organizationId, org.id),
            eq(organizationModules.moduleId, "chat"),
          ),
        );
    }
  });

  it("drops the email when an edit takes the name out, and never names other organizations' people", async () => {
    const edited = await priya.chat.send({
      channelId: channel.id,
      body: `<@${arjunId}> wrong person`,
    });

    await priya.chat.edit({ messageId: edited.id, body: "wrong person" });
    expect(
      await deliverMentionEmail(db, {
        messageId: edited.id,
        memberId: arjunId,
      }),
    ).toBe("unmentioned");

    const other = await world.org("Mention mail elsewhere");
    const stranger = await world.userIn(other, "owner", "Stranger Sharma");
    const lobby = await priya.chat.create({
      name: `lobby-${Date.now()}`,
      visibility: "public",
    });
    const probe = await priya.chat.send({
      channelId: lobby.id,
      body: `<@${meeraId}> ask <@${stranger.member.id}>`,
    });

    sent.length = 0;
    expect(
      await deliverMentionEmail(db, { messageId: probe.id, memberId: meeraId }),
    ).toBe("sent");
    // The other organization's person is never mailed.
    expect(
      await deliverMentionEmail(db, {
        messageId: probe.id,
        memberId: stranger.member.id,
      }),
    ).toBe("left");
    expect(sent[0]!.excerpt).not.toContain("Stranger Sharma");
  });

  it("sends nothing while the organization is suspended", async () => {
    const note = await priya.chat.send({
      channelId: channel.id,
      body: `<@${meeraId}> while paused`,
    });

    await db
      .update(organizations)
      .set({ suspendedAt: new Date() })
      .where(eq(organizations.id, org.id));
    forgetOrganizationStatus(org.id);

    try {
      expect(
        await deliverMentionEmail(db, {
          messageId: note.id,
          memberId: meeraId,
        }),
      ).toBe("suspended");
    } finally {
      await db
        .update(organizations)
        .set({ suspendedAt: null })
        .where(eq(organizations.id, org.id));
      forgetOrganizationStatus(org.id);
    }
  });

  it("emails people named in a forward's note, a poll, or an edit that adds them", async () => {
    const original = await priya.chat.send({
      channelId: channel.id,
      body: "Release notes are up",
    });
    const forwarded = await priya.chat.forward({
      messageId: original.id,
      channelId: channel.id,
      note: `<@${arjunId}> have a look`,
    });

    expect(
      (await queued(forwarded.messageId)).map((job) => job.payload),
    ).toEqual([
      expect.objectContaining({
        messageId: forwarded.messageId,
        memberId: arjunId,
      }),
    ]);

    const poll = await priya.chat.createPoll({
      channelId: channel.id,
      question: `<@${arjunId}> which day works?`,
      options: ["Mon", "Tue"],
    });

    expect(await queued(poll.messageId)).toHaveLength(1);

    const note = await priya.chat.send({
      channelId: channel.id,
      body: `<@${arjunId}> draft ready`,
    });

    await priya.chat.edit({
      messageId: note.id,
      body: `<@${arjunId}> and <@${meeraId}> draft ready`,
    });

    // Meera is new; Arjun was queued once already and is not queued again.
    expect(
      (await queued(note.id))
        .map((job) => (job.payload as { memberId: string }).memberId)
        .sort(),
    ).toEqual([arjunId, meeraId].sort());
  });

  it("emails someone an edit names, even if they read the channel before the edit", async () => {
    const k = await world.userIn(org, "member", "Kavi Rao");
    const kavi = await world.caller(k.user, org);
    const room = await priya.chat.create({
      name: `room-${Date.now()}`,
      visibility: "public",
      memberIds: [k.member.id],
    });
    const note = await priya.chat.send({
      channelId: room.id,
      body: "Agenda is up",
    });

    // Kavi reads the channel, then the edit names them.
    await kavi.chat.markRead({ channelId: room.id });
    await priya.chat.edit({
      messageId: note.id,
      body: `Agenda is up <@${k.member.id}>`,
    });
    // Taking the name out and putting it back still makes one email.
    await priya.chat.edit({ messageId: note.id, body: "Agenda is up" });
    await priya.chat.edit({
      messageId: note.id,
      body: `Agenda is up, <@${k.member.id}> please look`,
    });

    expect(await queued(note.id)).toHaveLength(1);

    sent.length = 0;
    expect(
      await deliverMentionEmail(db, {
        ...((await queued(note.id))[0]!.payload as {
          messageId: string;
          memberId: string;
          namedAt: string;
        }),
      }),
    ).toBe("sent");
    expect(sent.map((mail) => mail.excerpt)).toEqual([
      "Agenda is up, @Kavi Rao please look",
    ]);
  });
});
