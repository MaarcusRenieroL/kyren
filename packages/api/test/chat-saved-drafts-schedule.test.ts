import { db } from "@zentro/db";
import { chatScheduled } from "@zentro/db/schema";
import { eq } from "@zentro/db/drizzle";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runChatJobs } from "../src/server/chat-jobs";
import { World, type TestOrg } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;
type Jobs = Parameters<typeof runChatJobs>[0];

describe("chat: saved, drafts, scheduling and reading", () => {
  let org: TestOrg;
  let owner: Caller;
  let arjun: Caller;
  let arjunId: string;
  let channel: { id: string };

  beforeAll(async () => {
    org = await world.org("Chat extras");
    const o = await world.userIn(org, "owner", "Priya Raman");
    const a = await world.userIn(org, "member", "Arjun Mehta");

    owner = await world.caller(o.user, org);
    arjun = await world.caller(a.user, org);
    arjunId = a.member.id;
    channel = await owner.chat.create({ name: "extras", memberIds: [arjunId] });
  });

  it("saves a message and reminds about it when due", async () => {
    const message = await arjun.chat.send({
      channelId: channel.id,
      body: "Remember the launch checklist",
    });

    await owner.chat.saveMessage({ messageId: message.id, saved: true });
    await owner.chat.setReminder({
      messageId: message.id,
      remindAt: new Date(Date.now() + 3_600_000),
    });

    let saved = await owner.chat.savedList();

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ due: false });
    expect(saved[0]!.message.saved).not.toBeNull();

    await owner.chat.setReminder({
      messageId: message.id,
      remindAt: new Date(Date.now() - 1000),
    });
    saved = await owner.chat.savedList();
    expect(saved[0]).toMatchObject({ due: true });
    expect((await owner.chat.sidebar()).extras.dueReminders).toBe(1);

    await owner.chat.completeSaved({ messageId: message.id, done: true });
    expect((await owner.chat.sidebar()).extras.dueReminders).toBe(0);

    await owner.chat.saveMessage({ messageId: message.id, saved: false });
    expect(await owner.chat.savedList()).toEqual([]);
  });

  it("keeps a draft per composer and clears it when emptied", async () => {
    await owner.chat.draftSet({
      channelId: channel.id,
      scope: channel.id,
      body: "half a thought",
    });

    expect(await owner.chat.draftGet({ scope: channel.id })).toEqual({
      body: "half a thought",
    });
    expect(await owner.chat.draftList()).toMatchObject([
      { channelName: "extras", inThread: false },
    ]);
    expect(await arjun.chat.draftGet({ scope: channel.id })).toEqual({
      body: "",
    });

    await owner.chat.draftSet({
      channelId: channel.id,
      scope: channel.id,
      body: "  ",
    });
    expect(await owner.chat.draftList()).toEqual([]);
  });

  it("sends a scheduled message at its time, once", async () => {
    const { id } = await owner.chat.schedule({
      channelId: channel.id,
      body: "Standup in 5",
      sendAt: new Date(Date.now() + 120_000),
    });

    expect(await owner.chat.scheduledList()).toHaveLength(1);
    await expect(
      owner.chat.schedule({
        channelId: channel.id,
        body: "too soon",
        sendAt: new Date(Date.now() + 1000),
      }),
    ).rejects.toThrow(/future/);

    await db
      .update(chatScheduled)
      .set({ sendAt: new Date(Date.now() - 1000) })
      .where(eq(chatScheduled.id, id));

    const first = await runChatJobs(db as unknown as Jobs);
    const second = await runChatJobs(db as unknown as Jobs);

    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);

    const messages = await arjun.chat.messages({ channelId: channel.id });

    expect(
      messages.messages.filter((entry) => entry.body === "Standup in 5"),
    ).toHaveLength(1);
    expect(await owner.chat.scheduledList()).toEqual([]);
  });

  it("does not send a scheduled message after it was canceled", async () => {
    const { id } = await owner.chat.schedule({
      channelId: channel.id,
      body: "never sent",
      sendAt: new Date(Date.now() + 120_000),
    });

    await owner.chat.scheduledCancel({ id });
    await db
      .update(chatScheduled)
      .set({ sendAt: new Date(Date.now() - 1000) })
      .where(eq(chatScheduled.id, id));
    await runChatJobs(db as unknown as Jobs);

    const messages = await owner.chat.messages({ channelId: channel.id });

    expect(messages.messages.some((entry) => entry.body === "never sent")).toBe(
      false,
    );
  });

  it("marks a conversation unread from a message and shows read state", async () => {
    const message = await arjun.chat.send({
      channelId: channel.id,
      body: "read me",
    });

    await owner.chat.markRead({ channelId: channel.id });
    expect(
      (await owner.chat.sidebar()).channels.find((c) => c.id === channel.id)!
        .unread,
    ).toBe(0);

    await owner.chat.markUnread({
      channelId: channel.id,
      messageId: message.id,
    });
    expect(
      (await owner.chat.sidebar()).channels.find((c) => c.id === channel.id)!
        .unread,
    ).toBeGreaterThanOrEqual(1);

    const state = await arjun.chat.readState({ channelId: channel.id });

    expect(state.map((entry) => entry.name)).toEqual(["Priya Raman"]);
  });

  it("shows who is typing for a few seconds", async () => {
    await arjun.chat.typing({ channelId: channel.id });

    expect(await owner.chat.typingNow({ channelId: channel.id })).toEqual([
      "Arjun Mehta",
    ]);
    expect(await arjun.chat.typingNow({ channelId: channel.id })).toEqual([]);
  });

  it("follows threads you take part in, with unread counts", async () => {
    const parent = await owner.chat.send({
      channelId: channel.id,
      body: "Question for the thread",
    });

    await arjun.chat.send({
      channelId: channel.id,
      parentId: parent.id,
      body: "An answer",
    });

    let threads = await owner.chat.threads();
    let mine = threads.find((entry) => entry.message.id === parent.id)!;

    expect(mine.unread).toBe(1);

    await owner.chat.markThreadRead({ parentId: parent.id });
    threads = await owner.chat.threads();
    mine = threads.find((entry) => entry.message.id === parent.id)!;
    expect(mine.unread).toBe(0);

    await owner.chat.followThread({ parentId: parent.id, following: false });
    expect(
      (await owner.chat.threads()).some((e) => e.message.id === parent.id),
    ).toBe(false);
    expect(await owner.chat.threadFollowing({ parentId: parent.id })).toEqual({
      following: false,
    });
  });
});
