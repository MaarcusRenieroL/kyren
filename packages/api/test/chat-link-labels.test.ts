import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("a channel's link label does not name things the reader cannot see", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let arjun: Awaited<ReturnType<World["caller"]>>;
  let channelId: string;
  let openChannelId: string;

  beforeAll(async () => {
    const org = await world.org("Link labels");
    const o = await world.userIn(org, "owner", "Priya");
    const a = await world.userIn(org, "member", "Arjun");

    owner = await world.caller(o.user, org);
    arjun = await world.caller(a.user, org);

    const hidden = await world.project(org, {
      name: "Falcon secret",
      taskKeyPrefix: "FS",
      visibility: "private",
    });
    const open = await world.project(org, {
      name: "Open plans",
      taskKeyPrefix: "OP",
    });

    channelId = (
      await owner.chat.create({
        name: "falcon-chat",
        memberIds: [a.member.id],
        link: { type: "project", id: hidden.id },
      })
    ).id;
    openChannelId = (
      await owner.chat.create({
        name: "plans-chat",
        memberIds: [a.member.id],
        link: { type: "project", id: open.id },
      })
    ).id;
  });

  it("hides the name of a private project in the sidebar, browse and channel views", async () => {
    const sidebar = await arjun.chat.sidebar();
    const row = sidebar.channels.find((c) => c.id === channelId);

    expect(row?.link).toBeNull();
    expect(JSON.stringify(sidebar)).not.toContain("Falcon secret");
    expect(JSON.stringify(await arjun.chat.browse())).not.toContain(
      "Falcon secret",
    );
    expect(
      JSON.stringify(await arjun.chat.get({ id: channelId })),
    ).not.toContain("Falcon secret");
  });

  it("still labels a project the reader can see", async () => {
    const sidebar = await arjun.chat.sidebar();

    expect(
      sidebar.channels.find((c) => c.id === openChannelId)?.link,
    ).toMatchObject({ name: "Open plans" });
  });

  it("shows the owner both", async () => {
    const sidebar = await owner.chat.sidebar();

    expect(
      sidebar.channels.find((c) => c.id === channelId)?.link,
    ).toMatchObject({ name: "Falcon secret" });
  });
});
