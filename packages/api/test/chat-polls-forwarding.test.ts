import { db } from "@kyren/db";
import { chatMessages } from "@kyren/db/schema";
import { eq } from "@kyren/db/drizzle";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runChatJobs } from "../src/server/chat-jobs";
import { World, type TestOrg } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;
type Jobs = Parameters<typeof runChatJobs>[0];

describe("chat: polls, forwarding, status and channel extras", () => {
  let org: TestOrg;
  let owner: Caller;
  let arjun: Caller;
  let meera: Caller;
  let arjunId: string;
  let channel: { id: string };

  beforeAll(async () => {
    org = await world.org("Chat more");
    const o = await world.userIn(org, "owner", "Priya Raman");
    const a = await world.userIn(org, "member", "Arjun Mehta");
    const m = await world.userIn(org, "member", "Meera Iyer");

    owner = await world.caller(o.user, org);
    arjun = await world.caller(a.user, org);
    meera = await world.caller(m.user, org);
    arjunId = a.member.id;
    channel = await owner.chat.create({ name: "polls", memberIds: [arjunId] });
  });

  it("runs a single-choice poll: one vote each, changeable, closable", async () => {
    const { messageId } = await owner.chat.createPoll({
      channelId: channel.id,
      question: "Lunch?",
      options: ["Pizza", "Ramen", "Salad"],
    });
    const poll = (
      await owner.chat.messages({ channelId: channel.id })
    ).messages.find((entry) => entry.id === messageId)!.poll!;

    expect(poll).toMatchObject({ question: "Lunch?", total: 0, closed: false });

    await arjun.chat.votePoll({ pollId: poll.id, optionIndex: 0 });
    await arjun.chat.votePoll({ pollId: poll.id, optionIndex: 1 });
    await owner.chat.votePoll({ pollId: poll.id, optionIndex: 1 });

    const after = (
      await owner.chat.messages({ channelId: channel.id })
    ).messages.find((entry) => entry.id === messageId)!.poll!;

    expect(after.options.map((o) => o.votes)).toEqual([0, 2, 0]);
    expect(after.options[1]!.mine).toBe(true);
    expect(after.total).toBe(2);

    await expect(arjun.chat.closePoll({ pollId: poll.id })).rejects.toThrow(
      /author/,
    );
    await owner.chat.closePoll({ pollId: poll.id });
    await expect(
      arjun.chat.votePoll({ pollId: poll.id, optionIndex: 2 }),
    ).rejects.toThrow(/closed/);
  });

  it("forwards a message, and hides the origin from people who cannot read it", async () => {
    const secret = await owner.chat.create({
      name: "inner-circle",
      visibility: "private",
      memberIds: [arjunId],
    });
    const original = await owner.chat.send({
      channelId: secret.id,
      body: "Quarterly numbers look strong",
    });

    await arjun.chat.forward({
      messageId: original.id,
      channelId: channel.id,
      note: "FYI",
    });

    const forReader = (
      await arjun.chat.messages({ channelId: channel.id })
    ).messages.find((entry) => entry.body === "FYI")!;
    const forOutsider = (
      await meera.chat.messages({ channelId: channel.id })
    ).messages.find((entry) => entry.body === "FYI")!;

    expect(forReader.forwarded).toMatchObject({
      channelName: "inner-circle",
      authorName: "Priya Raman",
    });
    expect(forOutsider.forwarded).toBeNull();

    await expect(
      meera.chat.forward({ messageId: original.id, channelId: channel.id }),
    ).rejects.toThrow();
  });

  it("sets a status, and do not disturb silences the badge", async () => {
    await arjun.chat.statusSet({
      emoji: "🌴",
      text: "On leave",
      clearInMinutes: 60,
      dndMinutes: 30,
    });

    expect(await arjun.chat.statusGet()).toMatchObject({
      emoji: "🌴",
      text: "On leave",
    });

    const message = await arjun.chat.send({
      channelId: channel.id,
      body: "status check",
    });

    expect(message.author?.status).toMatchObject({ text: "On leave" });

    await owner.chat.send({
      channelId: channel.id,
      body: `<@${arjunId}> ping`,
    });
    expect((await arjun.chat.sidebar()).totalUnread).toBe(0);

    await arjun.chat.statusSet({
      emoji: null,
      text: null,
      clearInMinutes: null,
      dndMinutes: 0,
    });
    expect((await arjun.chat.sidebar()).totalUnread).toBeGreaterThan(0);
  });

  it("keeps bookmarks, a canvas note and retention for members and admins", async () => {
    await arjun.chat.addBookmark({
      channelId: channel.id,
      title: "Runbook",
      url: "https://example.com/runbook",
    });
    await expect(
      owner.chat.addBookmark({
        channelId: channel.id,
        title: "Bad",
        url: "javascript:alert(1)",
      }),
    ).rejects.toThrow();
    expect(await meera.chat.bookmarks({ channelId: channel.id })).toMatchObject(
      [{ title: "Runbook" }],
    );

    await arjun.chat.setCanvas({ channelId: channel.id, canvas: "Rules here" });
    expect(
      (await meera.chat.get({ name: "polls" })) as { canvas?: string },
    ).toMatchObject({
      canvas: "Rules here",
    });

    await expect(
      arjun.chat.setRetention({ channelId: channel.id, days: 30 }),
    ).rejects.toThrow(/admins/);
    await owner.chat.setRetention({ channelId: channel.id, days: 30 });
    await expect(
      arjun.chat.exportChannel({ channelId: channel.id }),
    ).rejects.toThrow(/admins/);

    const exported = await owner.chat.exportChannel({ channelId: channel.id });

    expect(exported.channel).toBe("polls");
    expect(exported.messages.length).toBeGreaterThan(0);
  });

  it("purges messages past retention but keeps pinned ones", async () => {
    const old = await owner.chat.send({
      channelId: channel.id,
      body: "ancient",
    });
    const keep = await owner.chat.send({
      channelId: channel.id,
      body: "pinned old",
    });

    await owner.chat.pin({ messageId: keep.id, pinned: true });
    await db
      .update(chatMessages)
      .set({ createdAt: new Date(Date.now() - 90 * 86_400_000) })
      .where(eq(chatMessages.id, old.id));
    await db
      .update(chatMessages)
      .set({ createdAt: new Date(Date.now() - 90 * 86_400_000) })
      .where(eq(chatMessages.id, keep.id));

    const result = await runChatJobs(db as unknown as Jobs, { heavy: true });

    expect(result.purged).toBeGreaterThanOrEqual(1);

    const bodies = (
      await owner.chat.messages({ channelId: channel.id })
    ).messages.map((entry) => entry.body);

    expect(bodies).not.toContain("ancient");
    expect(bodies).toContain("pinned old");
  });

  it("summarizes without a model by describing what is there", async () => {
    const { summary, ai } = await owner.chat.summarize({
      channelId: channel.id,
    });

    expect(ai).toBe(false);
    expect(summary).toMatch(/messages from/);
    await expect(
      owner.chat.translate({
        messageId: (await owner.chat.messages({ channelId: channel.id }))
          .messages[0]!.id,
        language: "French",
      }),
    ).rejects.toThrow(/turn on AI/);
  });
});
