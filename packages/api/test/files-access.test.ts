import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import {
  chatAttachments,
  chatChannels,
  chatMessages,
  files,
} from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("the file library", () => {
  let owner: Caller;
  let member: Caller;
  let org: Awaited<ReturnType<World["org"]>>;
  let libraryFileId: string;
  let secretFileId: string;
  let draftFileId: string;

  beforeAll(async () => {
    org = await world.org("Files access");
    const o = await world.userIn(org, "owner", "Priya");
    const m = await world.userIn(org, "member", "Arjun");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);

    const file = (name: string, source: "library" | "chat") =>
      db
        .insert(files)
        .values({
          organizationId: org.id,
          uploadedByMemberId: o.member.id,
          source,
          name,
          mimeType: "application/pdf",
          size: 10,
          storageKey: `${org.id}/${name}`,
        })
        .returning()
        .then((rows) => rows[0]!.id);

    libraryFileId = await file("roadmap.pdf", "library");
    secretFileId = await file("salaries.pdf", "chat");
    draftFileId = await file("draft-offer.pdf", "chat");

    const [channel] = await db
      .insert(chatChannels)
      .values({ organizationId: org.id, name: "exec", visibility: "private" })
      .returning();
    const [message] = await db
      .insert(chatMessages)
      .values({
        organizationId: org.id,
        channelId: channel!.id,
        authorMemberId: o.member.id,
        body: "see attached",
      })
      .returning();

    await db
      .insert(chatAttachments)
      .values({ messageId: message!.id, fileId: secretFileId });
  });

  it("a teammate can open a file uploaded to the library", async () => {
    const meta = await member.files.get({ id: libraryFileId });

    expect(meta.name).toBe("roadmap.pdf");
  });

  it("a file shared only in a private conversation stays out of the library", async () => {
    const names = (await member.files.library({ kind: "all" })).map(
      (f) => f.name,
    );

    expect(names).toContain("roadmap.pdf");
    expect(names).not.toContain("salaries.pdf");
    await expect(member.files.get({ id: secretFileId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("a chat upload that was never sent is private to its uploader", async () => {
    const names = (await member.files.library({ kind: "all" })).map(
      (f) => f.name,
    );

    expect(names).not.toContain("draft-offer.pdf");
    await expect(member.files.get({ id: draftFileId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await owner.files.get({ id: draftFileId })).name).toBe(
      "draft-offer.pdf",
    );
  });

  it("library downloads do not depend on the chat module", async () => {
    await world.setModule(org, "chat", false);

    try {
      expect((await member.files.get({ id: libraryFileId })).name).toBe(
        "roadmap.pdf",
      );
    } finally {
      await world.setModule(org, "chat", true);
    }
  });

  it("deleting a file that messages still use is refused, not silently broken", async () => {
    await expect(
      owner.files.remove({ id: secretFileId }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(owner.files.remove({ id: libraryFileId })).resolves.toEqual({
      id: libraryFileId,
    });
  });
});
