import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { organizations } from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  deliverMentionEmail,
  setMentionMailer,
  type MentionMail,
} from "../src/server/chat-mention-mail";
import { forgetOrganizationStatus } from "../src/server/platform-policy";
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

describe("chat mention emails edits and forwards", () => {
  let ctx: Context;

  beforeAll(async () => {
    setMentionMailer(async (mail) => {
      sent.push(mail);
    });
    ctx = await setupChatMentionTest(world, sent);
  });

  it("drops the email when an edit takes the name out, and never names other organizations' people", async () => {
    const edited = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: `<@${ctx.arjunId}> wrong person`,
    });

    await ctx.priya.chat.edit({ messageId: edited.id, body: "wrong person" });
    expect(
      await deliverMentionEmail(db, {
        messageId: edited.id,
        memberId: ctx.arjunId,
      }),
    ).toBe("unmentioned");

    const other = await world.org("Mention mail elsewhere");
    const stranger = await world.userIn(other, "owner", "Stranger Sharma");
    const lobby = await ctx.priya.chat.create({
      name: `lobby-${Date.now()}`,
      visibility: "public",
    });
    const probe = await ctx.priya.chat.send({
      channelId: lobby.id,
      body: `<@${ctx.meeraId}> ask <@${stranger.member.id}>`,
    });

    sent.length = 0;
    expect(
      await deliverMentionEmail(db, {
        messageId: probe.id,
        memberId: ctx.meeraId,
      }),
    ).toBe("sent");
    expect(
      await deliverMentionEmail(db, {
        messageId: probe.id,
        memberId: stranger.member.id,
      }),
    ).toBe("left");
    expect(sent[0]!.excerpt).not.toContain("Stranger Sharma");
  });

  it("sends nothing while the organization is suspended", async () => {
    const note = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: `<@${ctx.meeraId}> while paused`,
    });

    await db
      .update(organizations)
      .set({ suspendedAt: new Date() })
      .where(eq(organizations.id, ctx.org.id));
    forgetOrganizationStatus(ctx.org.id);

    try {
      expect(
        await deliverMentionEmail(db, {
          messageId: note.id,
          memberId: ctx.meeraId,
        }),
      ).toBe("suspended");
    } finally {
      await db
        .update(organizations)
        .set({ suspendedAt: null })
        .where(eq(organizations.id, ctx.org.id));
      forgetOrganizationStatus(ctx.org.id);
    }
  });

  it("emails people named in a forward's note, a poll, or an edit that adds them", async () => {
    const original = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: "Release notes are up",
    });
    const forwarded = await ctx.priya.chat.forward({
      messageId: original.id,
      channelId: ctx.channel.id,
      note: `<@${ctx.arjunId}> have a look`,
    });

    expect(
      (await queuedMentionJob(forwarded.messageId)).map((job) => job.payload),
    ).toEqual([
      expect.objectContaining({
        messageId: forwarded.messageId,
        memberId: ctx.arjunId,
      }),
    ]);

    const poll = await ctx.priya.chat.createPoll({
      channelId: ctx.channel.id,
      question: `<@${ctx.arjunId}> which day works?`,
      options: ["Mon", "Tue"],
    });

    expect(await queuedMentionJob(poll.messageId)).toHaveLength(1);

    const note = await ctx.priya.chat.send({
      channelId: ctx.channel.id,
      body: `<@${ctx.arjunId}> draft ready`,
    });

    await ctx.priya.chat.edit({
      messageId: note.id,
      body: `<@${ctx.arjunId}> and <@${ctx.meeraId}> draft ready`,
    });

    expect(
      (await queuedMentionJob(note.id))
        .map((job) => (job.payload as { memberId: string }).memberId)
        .sort(),
    ).toEqual([ctx.arjunId, ctx.meeraId].sort());
  });

  it("emails someone an edit names, even if they read the channel before the edit", async () => {
    const k = await world.userIn(ctx.org, "member", "Kavi Rao");
    const kavi = await world.caller(k.user, ctx.org);
    const room = await ctx.priya.chat.create({
      name: `room-${Date.now()}`,
      visibility: "public",
      memberIds: [k.member.id],
    });
    const note = await ctx.priya.chat.send({
      channelId: room.id,
      body: "Agenda is up",
    });

    await kavi.chat.markRead({ channelId: room.id });
    await ctx.priya.chat.edit({
      messageId: note.id,
      body: `Agenda is up <@${k.member.id}>`,
    });
    await ctx.priya.chat.edit({ messageId: note.id, body: "Agenda is up" });
    await ctx.priya.chat.edit({
      messageId: note.id,
      body: `Agenda is up, <@${k.member.id}> please look`,
    });

    expect(await queuedMentionJob(note.id)).toHaveLength(1);

    sent.length = 0;
    expect(
      await deliverMentionEmail(db, {
        ...((await queuedMentionJob(note.id))[0]!.payload as {
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
