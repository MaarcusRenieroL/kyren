import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupChatLinking } from "./helpers/chat-linking-setup";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Context = Awaited<ReturnType<typeof setupChatLinking>>;

describe("chat links to tasks, docs and projects", () => {
  let ctx: Context;

  beforeAll(async () => {
    ctx = await setupChatLinking(world);
  });

  it("opens a private discussion for a task, once, for people who can see it", async () => {
    const first = await ctx.owner.chat.discuss({
      type: "task",
      id: ctx.task.id,
    });

    expect(first).toMatchObject({ created: true });
    expect(first.name).toMatch(/^task-/);

    const again = await ctx.member.chat.discuss({
      type: "task",
      id: ctx.task.id,
    });

    expect(again).toMatchObject({ created: false, channelId: first.channelId });

    const summary = await ctx.member.chat.discussion({
      type: "task",
      id: ctx.task.id,
    });

    expect(summary).toMatchObject({ exists: true, joined: true });
    expect(
      (await ctx.outsider.chat.browse()).map((entry) => entry.name),
    ).not.toContain(first.name);
  });

  it("shows a discussion's link label in the sidebar", async () => {
    const channel = (await ctx.owner.chat.sidebar()).channels.find((entry) =>
      entry.name?.startsWith("task-"),
    );

    expect(channel?.link).toMatchObject({
      type: "task",
      key: ctx.task.key,
      href: `/tasks/${ctx.task.key}`,
    });
  });

  it("opens discussions for a doc and a project, and refuses what you cannot see", async () => {
    expect(
      await ctx.owner.chat.discuss({ type: "doc", id: ctx.doc.id }),
    ).toMatchObject({ created: true });
    expect(
      await ctx.owner.chat.discuss({ type: "project", id: ctx.projectId }),
    ).toMatchObject({ created: false, name: "project-billing-link" });

    await expect(
      ctx.owner.chat.discuss({
        type: "task",
        id: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toThrow(/not found/);
  });

  it("turns a doc or project link into a card, and hides what the viewer cannot open", async () => {
    const channel = await ctx.owner.chat.create({ name: "cards" });
    const message = await ctx.owner.chat.send({
      channelId: channel.id,
      body: `Spec: /docs/${ctx.doc.slug} and /projects/billing-link and /docs/no-such-doc`,
    });

    expect(message.entities).toMatchObject([
      { type: "doc", title: "Pricing spec", href: `/docs/${ctx.doc.slug}` },
      { type: "project", title: "Billing", href: "/projects/billing-link" },
    ]);
    expect(message.entities).toHaveLength(2);

    const external = await ctx.owner.chat.send({
      channelId: channel.id,
      body: `See https://example.com/docs/${ctx.doc.slug}`,
    });

    expect(external.entities).toEqual([]);
  });

  it("quotes a link to another message, but not one the viewer cannot read", async () => {
    const open = await ctx.owner.chat.create({ name: "open-room" });
    const secret = await ctx.owner.chat.create({
      name: "secret-room",
      visibility: "private",
    });
    const said = await ctx.owner.chat.send({
      channelId: secret.id,
      body: "Salary bands are attached",
    });
    const visible = await ctx.owner.chat.send({
      channelId: open.id,
      body: "Everyone can read this one",
    });
    const shared = await ctx.owner.chat.send({
      channelId: open.id,
      body: `See /chat/open-room?m=${visible.id} and /chat/secret-room?m=${said.id}`,
    });

    expect(shared.entities).toMatchObject([
      { type: "message", excerpt: "Everyone can read this one" },
      { type: "message", subtitle: "#secret-room" },
    ]);

    const asOutsider = (
      await ctx.outsider.chat.messages({ channelId: open.id })
    ).messages.find((entry) => entry.id === shared.id)!;

    expect(asOutsider.entities).toMatchObject([
      { type: "message", excerpt: "Everyone can read this one" },
      { type: "missing" },
    ]);
    expect(JSON.stringify(asOutsider.entities)).not.toContain("Salary");
  });

  it("searches tasks, docs and projects to link", async () => {
    const result = await ctx.owner.chat.linkSearch({ q: "pr" });

    expect(result.tasks.map((entry) => entry.key)).toContain(ctx.task.key);
    expect(result.docs.map((entry) => entry.slug)).toContain(ctx.doc.slug);
    expect(result.projects.map((entry) => entry.slug)).not.toContain(
      "billing-link",
    );
    expect(
      (await ctx.owner.chat.linkSearch({ q: "bill" })).projects.map(
        (entry) => entry.slug,
      ),
    ).toContain("billing-link");
  });
});
