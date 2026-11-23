import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("chat operations, reactions and moderation", () => {
  let org: TestOrg;
  let owner: Caller;
  let arjun: Caller;
  let meera: Caller;
  let ownerId: string;
  let arjunId: string;
  let meeraId: string;
  let platform: { id: string; name: string };

  beforeAll(async () => {
    org = await world.org("ChattyOps");
    const o = await world.userIn(org, "owner", "Priya Raman");
    const a = await world.userIn(org, "member", "Arjun Mehta");
    const m = await world.userIn(org, "member", "Meera Iyer");

    owner = await world.caller(o.user, org);
    arjun = await world.caller(a.user, org);
    meera = await world.caller(m.user, org);
    ownerId = o.member.id;
    arjunId = a.member.id;
    meeraId = m.member.id;

    platform = await owner.chat.create({
      name: "Platform",
      topic: "Auth and the API gateway",
      memberIds: [arjunId, meeraId],
    });
  });

  it("toggles reactions and keeps queued sends from doubling", async () => {
    const message = await arjun.chat.send({
      channelId: platform.id,
      body: "Reverted",
      clientId: "queued-1",
    });
    const again = await arjun.chat.send({
      channelId: platform.id,
      body: "Reverted",
      clientId: "queued-1",
    });

    expect(again.id).toBe(message.id);

    await owner.chat.react({ messageId: message.id, emoji: "✅" });
    await meera.chat.react({ messageId: message.id, emoji: "✅" });

    let view = (
      await owner.chat.messages({ channelId: platform.id })
    ).messages.find((entry) => entry.id === message.id)!;

    expect(view.reactions).toMatchObject([
      { emoji: "✅", count: 2, mine: true },
    ]);

    await owner.chat.react({ messageId: message.id, emoji: "✅" });
    view = (
      await owner.chat.messages({ channelId: platform.id })
    ).messages.find((entry) => entry.id === message.id)!;
    expect(view.reactions).toMatchObject([{ count: 1, mine: false }]);
  });

  it("edits and deletes only your own messages", async () => {
    const message = await arjun.chat.send({
      channelId: platform.id,
      body: "typo",
    });

    await expect(
      meera.chat.edit({ messageId: message.id, body: "nope" }),
    ).rejects.toBeInstanceOf(TRPCError);
    await arjun.chat.edit({ messageId: message.id, body: "fixed" });
    await expect(
      meera.chat.remove({ messageId: message.id }),
    ).rejects.toBeInstanceOf(TRPCError);

    await owner.chat.remove({ messageId: message.id });

    const view = (
      await owner.chat.messages({ channelId: platform.id })
    ).messages.find((entry) => entry.id === message.id)!;

    expect(view).toMatchObject({ deleted: true, body: "" });
  });

  it("finds messages by words, author and place", async () => {
    await arjun.chat.send({
      channelId: platform.id,
      body: "Okta posts back to the callback cross-site",
    });

    const all = await owner.chat.search({ q: "callback" });

    expect(all.results.map((entry) => entry.body)).toEqual([
      "Okta posts back to the callback cross-site",
    ]);
    expect(all.results[0]!.channel.name).toBe("platform");
    expect(
      (await owner.chat.search({ q: "callback", fromMemberId: meeraId })).total,
    ).toBe(0);
  });

  it("reuses a direct message between the same people", async () => {
    const first = await owner.chat.openDm({ memberIds: [meeraId] });
    const second = await meera.chat.openDm({ memberIds: [ownerId] });

    expect(second.id).toBe(first.id);
    await owner.chat.send({ channelId: first.id, body: "hey" });
    await expect(
      arjun.chat.messages({ channelId: first.id }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("pins, archives and keeps at least one admin", async () => {
    const message = await owner.chat.send({
      channelId: platform.id,
      body: "Release freeze starts Friday",
    });

    await arjun.chat.pin({ messageId: message.id, pinned: true });
    expect((await owner.chat.pins({ channelId: platform.id })).length).toBe(1);

    await expect(
      owner.chat.setRole({
        channelId: platform.id,
        memberId: ownerId,
        role: "member",
      }),
    ).rejects.toThrow(/at least one admin/);
    await expect(
      arjun.chat.archive({ channelId: platform.id, archived: true }),
    ).rejects.toBeInstanceOf(TRPCError);

    await owner.chat.archive({ channelId: platform.id, archived: true });
    await expect(
      arjun.chat.send({ channelId: platform.id, body: "still here?" }),
    ).rejects.toThrow(/archived/);
  });
});
