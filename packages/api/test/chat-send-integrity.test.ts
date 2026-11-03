import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("sending chat messages", () => {
  let owner: Caller;
  let arjun: Caller;
  let ownerId: string;
  let arjunId: string;
  let channelId: string;

  beforeAll(async () => {
    const org = await world.org("Chat send");
    const o = await world.userIn(org, "owner", "Priya Raman");
    const a = await world.userIn(org, "member", "Arjun Mehta");

    owner = await world.caller(o.user, org);
    arjun = await world.caller(a.user, org);
    ownerId = o.member.id;
    arjunId = a.member.id;
    channelId = (
      await owner.chat.create({ name: "send", memberIds: [arjunId] })
    ).id;
  });

  it("returns the same message when a retry races the original", async () => {
    const send = () =>
      arjun.chat.send({ channelId, body: "Queued offline", clientId: "c-1" });
    const [first, second] = await Promise.all([send(), send()]);

    expect(second.id).toBe(first.id);
  });

  it("does not mark the channel read when a thread reply is posted", async () => {
    const top = await owner.chat.send({ channelId, body: "Top level one" });

    await owner.chat.send({ channelId, body: "Top level two" });

    const before = (await arjun.chat.sidebar()).channels.find(
      (channel) => channel.id === channelId,
    );

    expect(before?.unread).toBeGreaterThanOrEqual(2);

    await arjun.chat.send({
      channelId,
      body: "A thread reply",
      parentId: top.id,
    });

    const after = (await arjun.chat.sidebar()).channels.find(
      (channel) => channel.id === channelId,
    );

    expect(after?.unread).toBe(before?.unread);
    expect(ownerId).toBeTruthy();
  });
});
