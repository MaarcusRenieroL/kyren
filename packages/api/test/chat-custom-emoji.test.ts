import { db } from "@kyren/db";
import { files } from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("chat: custom emoji", () => {
  let org: TestOrg;
  let owner: Caller;
  let member: Caller;
  let ownerId: string;

  beforeAll(async () => {
    org = await world.org("Emoji org");
    const o = await world.userIn(org, "owner", "Priya Raman");
    const m = await world.userIn(org, "member", "Arjun Mehta");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    ownerId = o.member.id;
  });

  const upload = async (mimeType: string, size: number) => {
    const [row] = await db
      .insert(files)
      .values({
        organizationId: org.id,
        uploadedByMemberId: ownerId,
        name: "party.png",
        mimeType,
        size,
        storageKey: `test/${Math.random()}`,
      })
      .returning({ id: files.id });

    return row!.id;
  };

  it("adds an emoji from a small image, and refuses anything else", async () => {
    await owner.chat.emojiCreate({
      name: "Party-Parrot",
      fileId: await upload("image/png", 4000),
    });
    expect(await member.chat.emojiList()).toMatchObject([
      { name: "party-parrot" },
    ]);

    await expect(
      owner.chat.emojiCreate({
        name: "doc",
        fileId: await upload("application/pdf", 4000),
      }),
    ).rejects.toThrow(/image/);
    await expect(
      owner.chat.emojiCreate({
        name: "huge",
        fileId: await upload("image/png", 900_000),
      }),
    ).rejects.toThrow(/256 KB/);
    await expect(
      owner.chat.emojiCreate({
        name: "party-parrot",
        fileId: await upload("image/png", 4000),
      }),
    ).rejects.toThrow(/taken/);
    await expect(
      owner.chat.emojiCreate({
        name: "x",
        fileId: await upload("image/png", 4000),
      }),
    ).rejects.toThrow();
  });

  it("lets everyone in the organization open an emoji image, and only admins delete it", async () => {
    const emoji = (await member.chat.emojiList())[0]!;
    const id = emoji.url.split("/").pop()!;

    expect(await member.files.get({ id })).toMatchObject({ name: "party.png" });

    await expect(
      member.chat.emojiDelete({ name: "party-parrot" }),
    ).rejects.toThrow();
    await owner.chat.emojiDelete({ name: "party-parrot" });
    expect(await member.chat.emojiList()).toEqual([]);
  });
});
