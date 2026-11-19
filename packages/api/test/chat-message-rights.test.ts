import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("changing chat messages after the fact", () => {
  let owner: Caller;
  let arjun: Caller;
  let meera: Caller;
  let arjunId: string;
  let meeraId: string;

  beforeAll(async () => {
    const org = await world.org("Chat rights");
    const o = await world.userIn(org, "owner", "Owner");
    const a = await world.userIn(org, "member", "Arjun");
    const m = await world.userIn(org, "member", "Meera");

    owner = await world.caller(o.user, org);
    arjun = await world.caller(a.user, org);
    meera = await world.caller(m.user, org);
    arjunId = a.member.id;
    meeraId = m.member.id;
  });

  it("a removed member can no longer edit what they wrote in a private channel", async () => {
    const secret = await owner.chat.create({
      name: "exec-rights",
      visibility: "private",
    });

    await owner.chat.addMembers({ channelId: secret.id, memberIds: [arjunId] });

    const sent = await arjun.chat.send({ channelId: secret.id, body: "draft" });

    await owner.chat.removeMember({ channelId: secret.id, memberId: arjunId });

    await expect(
      arjun.chat.edit({ messageId: sent.id, body: "rewritten" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("nobody edits in an archived channel", async () => {
    const channel = await owner.chat.create({ name: "old-rights" });
    const sent = await owner.chat.send({ channelId: channel.id, body: "v1" });

    await owner.chat.archive({ channelId: channel.id, archived: true });

    await expect(
      owner.chat.edit({ messageId: sent.id, body: "v2" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("only the pinner or a channel admin takes a pin down", async () => {
    const channel = await owner.chat.create({ name: "pins-rights" });

    await owner.chat.addMembers({
      channelId: channel.id,
      memberIds: [arjunId, meeraId],
    });

    const sent = await owner.chat.send({
      channelId: channel.id,
      body: "Read me",
    });

    await arjun.chat.pin({ messageId: sent.id, pinned: true });

    await expect(
      meera.chat.pin({ messageId: sent.id, pinned: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.chat.pin({ messageId: sent.id, pinned: false }),
    ).resolves.toEqual({ ok: true });
  });
});
