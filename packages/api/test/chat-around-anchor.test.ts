import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("messages around an anchor stay in the requested channel", () => {
  let arjun: Awaited<ReturnType<World["caller"]>>;
  let openChannel: string;
  let openMessage: string;
  let secretMessage: string;

  beforeAll(async () => {
    const org = await world.org("Around anchor");
    const o = await world.userIn(org, "owner", "Priya");
    const a = await world.userIn(org, "member", "Arjun");
    const owner = await world.caller(o.user, org);

    arjun = await world.caller(a.user, org);

    const open = await owner.chat.create({
      name: "open",
      memberIds: [a.member.id],
    });
    const other = await owner.chat.create({ name: "other" });
    const secret = await owner.chat.create({
      name: "secret",
      visibility: "private",
    });

    openChannel = open.id;
    openMessage = (await owner.chat.send({ channelId: open.id, body: "hi" }))
      .id;
    await owner.chat.send({ channelId: other.id, body: "elsewhere" });
    secretMessage = (
      await owner.chat.send({ channelId: secret.id, body: "private" })
    ).id;
  });

  it("jumps to a message in the same channel", async () => {
    const page = await arjun.chat.messages({
      channelId: openChannel,
      aroundId: openMessage,
    });

    expect(page.messages.map((m) => m.id)).toContain(openMessage);
  });

  it("refuses an anchor from a private channel", async () => {
    await expect(
      arjun.chat.messages({ channelId: openChannel, aroundId: secretMessage }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
