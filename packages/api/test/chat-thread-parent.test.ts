import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("scheduled messages and polls stay in their own thread", () => {
  let arjun: Caller;
  let publicChannel: string;
  let privateMessage: string;
  let publicMessage: string;
  let foreignMessage: string;

  beforeAll(async () => {
    const org = await world.org("Thread parent");
    const other = await world.org("Thread parent other");
    const o = await world.userIn(org, "owner", "Priya");
    const a = await world.userIn(org, "member", "Arjun");
    const x = await world.userIn(other, "owner", "Olga");
    const owner = await world.caller(o.user, org);
    const outsider = await world.caller(x.user, other);

    arjun = await world.caller(a.user, org);

    const open = await owner.chat.create({
      name: "open",
      memberIds: [a.member.id],
    });
    const secret = await owner.chat.create({
      name: "secret",
      visibility: "private",
    });
    const foreign = await outsider.chat.create({ name: "elsewhere" });

    publicChannel = open.id;
    publicMessage = (await owner.chat.send({ channelId: open.id, body: "hi" }))
      .id;
    privateMessage = (
      await owner.chat.send({ channelId: secret.id, body: "private" })
    ).id;
    foreignMessage = (
      await outsider.chat.send({ channelId: foreign.id, body: "theirs" })
    ).id;
  });

  const sendAt = () => new Date(Date.now() + 3_600_000);

  it("refuses a parent from another channel, a private one or another org", async () => {
    for (const parentId of [privateMessage, foreignMessage]) {
      await expect(
        arjun.chat.schedule({
          channelId: publicChannel,
          parentId,
          body: "sneaky",
          sendAt: sendAt(),
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(
        arjun.chat.createPoll({
          channelId: publicChannel,
          parentId,
          question: "Sneaky?",
          options: ["a", "b"],
          multiple: false,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("still allows a reply in a thread of the same channel", async () => {
    await expect(
      arjun.chat.schedule({
        channelId: publicChannel,
        parentId: publicMessage,
        body: "later",
        sendAt: sendAt(),
      }),
    ).resolves.toHaveProperty("id");

    await expect(
      arjun.chat.createPoll({
        channelId: publicChannel,
        parentId: publicMessage,
        question: "Fine?",
        options: ["a", "b"],
        multiple: false,
      }),
    ).resolves.toHaveProperty("messageId");
  });
});
