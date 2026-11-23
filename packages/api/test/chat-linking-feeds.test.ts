import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupChatLinking } from "./helpers/chat-linking-setup";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Context = Awaited<ReturnType<typeof setupChatLinking>>;

describe("chat feeds and automations", () => {
  let ctx: Context;

  beforeAll(async () => {
    ctx = await setupChatLinking(world);
  });

  it("shows the task created from a message as a card on that message", async () => {
    const channel = await ctx.owner.chat.create({
      name: "triage",
      memberIds: [ctx.memberId],
    });
    const message = await ctx.member.chat.send({
      channelId: channel.id,
      body: "The export button is broken",
    });
    const created = await ctx.owner.task.createTask({
      projectId: ctx.projectId,
      name: "Fix export button",
      linkMessageId: message.id,
    });
    const after = (
      await ctx.owner.chat.messages({ channelId: channel.id })
    ).messages.find((entry) => entry.id === message.id)!;

    expect(after.tasks).toMatchObject([
      { key: created.key, name: "Fix export button" },
    ]);

    await ctx.owner.task.updateTaskByKey({ key: created.key, status: "done" });

    const thread = await ctx.owner.chat.thread({ messageId: message.id });

    expect(thread.replies).toMatchObject([
      { kind: "event", body: `marked ${created.key} as done` },
    ]);
  });

  it("posts task events to a project channel that asked for them", async () => {
    const channel = await ctx.owner.chat.create({
      name: "billing-feed",
      link: { type: "project", id: ctx.projectId },
    });

    await expect(
      ctx.owner.chat.feedSet({
        channelId: channel.id,
        enabled: true,
        events: ["created", "done"],
      }),
    ).resolves.toEqual({ ok: true });
    expect(await ctx.owner.chat.feedGet({ channelId: channel.id })).toEqual({
      enabled: true,
      events: ["created", "done"],
    });

    const created = await ctx.owner.task.createTask({
      projectId: ctx.projectId,
      name: "Ship it",
    });
    const feed = await ctx.owner.chat.messages({ channelId: channel.id });

    expect(feed.messages).toMatchObject([
      { kind: "event", body: `created ${created.key} · Ship it` },
    ]);
    expect(feed.messages[0]!.tasks).toMatchObject([{ key: created.key }]);

    await ctx.owner.task.updateTaskByKey({
      key: created.key,
      assignedToMemberId: ctx.memberId,
    });
    expect(
      (await ctx.owner.chat.messages({ channelId: channel.id })).messages,
    ).toHaveLength(1);

    await ctx.owner.task.updateTaskByKey({ key: created.key, status: "done" });
    expect(
      (await ctx.owner.chat.messages({ channelId: channel.id })).messages,
    ).toHaveLength(2);
  });

  it("posts a subtask's creation to the feed too", async () => {
    const channel = await ctx.owner.chat.create({
      name: "feed-subtasks",
      link: { type: "project", id: ctx.projectId },
    });

    await ctx.owner.chat.feedSet({
      channelId: channel.id,
      enabled: true,
      events: ["created"],
    });

    const parent = await ctx.owner.task.createTask({
      projectId: ctx.projectId,
      name: "Parent",
    });
    const before = (await ctx.owner.chat.messages({ channelId: channel.id }))
      .messages.length;
    const sub = await ctx.owner.task.createSubtask({
      parentTaskKey: parent.key,
      name: "Child step",
    });
    const after = (await ctx.owner.chat.messages({ channelId: channel.id }))
      .messages;

    expect(after).toHaveLength(before + 1);
    expect(after.at(-1)!.body).toBe(`created ${sub.key} · Child step`);
  });

  it("needs a linked project for the feed, and only channel admins set it", async () => {
    const plain = await ctx.owner.chat.create({ name: "not-linked" });

    await expect(
      ctx.owner.chat.feedSet({
        channelId: plain.id,
        enabled: true,
        events: ["done"],
      }),
    ).rejects.toThrow(/project/);

    const linked = await ctx.owner.chat.create({
      name: "linked-two",
      link: { type: "project", id: ctx.projectId },
      memberIds: [ctx.memberId],
    });

    await expect(
      ctx.member.chat.feedSet({
        channelId: linked.id,
        enabled: true,
        events: ["done"],
      }),
    ).rejects.toThrow(/admins/);
  });

  it("runs a chat automation: a matching message makes a task and says so", async () => {
    const channel = await ctx.owner.chat.create({ name: "bug-reports" });

    await expect(
      ctx.owner.automation.create({
        name: "Bug to task",
        triggerEvent: "chat.message_contains",
        triggerConfig: {},
        actionType: "create_task",
        actionConfig: {},
        projectId: ctx.projectId,
      }),
    ).rejects.toThrow(/words/);
    await expect(
      ctx.owner.automation.create({
        name: "No project",
        triggerEvent: "chat.message_contains",
        triggerConfig: { contains: "bug:" },
        actionType: "create_task",
        actionConfig: {},
      }),
    ).rejects.toThrow(/project/);

    await ctx.owner.automation.create({
      name: "Bug to task",
      triggerEvent: "chat.message_contains",
      triggerConfig: { contains: "bug:", channelId: channel.id },
      actionType: "create_task",
      actionConfig: {},
      projectId: ctx.projectId,
    });

    const quiet = await ctx.owner.chat.send({
      channelId: channel.id,
      body: "Just chatting",
    });
    const report = await ctx.owner.chat.send({
      channelId: channel.id,
      body: "BUG: export fails on Safari",
    });
    const thread = await ctx.owner.chat.thread({ messageId: report.id });

    expect(thread.replies).toHaveLength(1);
    expect(thread.replies[0]!.body).toMatch(
      /created [A-Z0-9]+-\d+ from this message/,
    );
    expect(
      (await ctx.owner.chat.thread({ messageId: quiet.id })).replies,
    ).toHaveLength(0);

    const after = (
      await ctx.owner.chat.messages({ channelId: channel.id })
    ).messages.find((entry) => entry.id === report.id)!;

    expect(after.tasks).toMatchObject([
      { name: "BUG: export fails on Safari" },
    ]);

    const other = await ctx.owner.chat.create({ name: "elsewhere" });
    const ignored = await ctx.owner.chat.send({
      channelId: other.id,
      body: "bug: not here",
    });

    expect(
      (await ctx.owner.chat.thread({ messageId: ignored.id })).replies,
    ).toHaveLength(0);
  });

  it("refuses a post-to-channel rule for a channel the creator cannot post in", async () => {
    const closed = await ctx.owner.chat.create({
      name: "owners-only",
      visibility: "private",
    });

    await expect(
      ctx.member.automation.create({
        name: "Sneaky",
        triggerEvent: "task.created",
        triggerConfig: {},
        actionType: "post_to_channel",
        actionConfig: { channelId: closed.id },
      }),
    ).rejects.toThrow();
  });

  it("finds where a file was shared", async () => {
    expect(
      await ctx.owner.chat.fileDiscussions({
        fileId: "00000000-0000-4000-8000-000000000000",
      }),
    ).toEqual([]);
  });
});
