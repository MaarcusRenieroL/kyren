import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { files } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

it("filters and sorts the file library before paginating", async () => {
  const org = await world.org("File table");
  const owner = await world.userIn(org, "owner", "Table Owner");
  const member = await world.userIn(org, "member", "Table Member");
  const caller = await world.caller(owner.user, org);
  const fixtures = [
    { name: "report-small.pdf", size: 5 },
    { name: "report-medium.pdf", size: 20 },
    { name: "report-large.pdf", size: 30 },
    { name: "report-huge.pdf", size: 50 },
    { name: "report-old.pdf", size: 35, day: 9 },
    { name: "report-other.pdf", size: 38, uploader: member.member.id },
    { name: "report-preview.png", size: 40, mimeType: "image/png" },
    { name: "notes.pdf", size: 42 },
  ];

  await db.insert(files).values(
    fixtures.map((file) => ({
      organizationId: org.id,
      uploadedByMemberId: file.uploader ?? owner.member.id,
      source: "library" as const,
      name: file.name,
      mimeType: file.mimeType ?? "application/pdf",
      size: file.size,
      storageKey: `${org.id}/${file.name}`,
      createdAt: new Date(Date.UTC(2025, 0, file.day ?? 10)),
    })),
  );

  const input = {
    search: "report",
    kind: "document" as const,
    uploaderId: owner.member.id,
    minBytes: 10,
    maxBytes: 45,
    uploadedFrom: "2025-01-10T00:00:00.000Z",
    uploadedBefore: "2025-01-11T00:00:00.000Z",
    sort: { column: "size" as const, descending: true },
    limit: 1,
  };

  expect((await caller.files.library(input)).map((file) => file.name)).toEqual([
    "report-large.pdf",
  ]);
  expect(
    (await caller.files.library({ ...input, offset: 1 })).map(
      (file) => file.name,
    ),
  ).toEqual(["report-medium.pdf"]);
});

describe("file library folders", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let roadmap: string;
  let contracts: string;

  beforeAll(async () => {
    const org = await world.org("Folders");
    const o = await world.userIn(org, "owner", "Folder Owner");
    const m = await world.userIn(org, "member", "Folder Member");
    const other = await world.org("Folders elsewhere");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(
      (await world.userIn(other, "owner", "Folder Outsider")).user,
      other,
    );

    const [file] = await db
      .insert(files)
      .values({
        organizationId: org.id,
        uploadedByMemberId: o.member.id,
        source: "library",
        name: "roadmap.pdf",
        mimeType: "application/pdf",
        size: 10,
        storageKey: `${org.id}/folders-roadmap.pdf`,
      })
      .returning();

    roadmap = file!.id;
  });

  it("makes folders with names unique in the organization", async () => {
    ({ id: contracts } = await owner.files.createFolder({ name: "Contracts" }));

    await expect(
      owner.files.createFolder({ name: "contracts" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "There is already a folder with that name.",
    });
    // Another organization may use the same name.
    await expect(
      outsider.files.createFolder({ name: "Contracts" }),
    ).resolves.toMatchObject({ id: expect.any(String) });
  });

  it("moves a file in, lists by folder, and searches across folders", async () => {
    await owner.files.moveFile({ id: roadmap, folderId: contracts });

    const names = async (input: Parameters<Caller["files"]["library"]>[0]) =>
      (await owner.files.library(input)).map((file) => file.name);

    expect(await names({ kind: "all", folderId: contracts })).toEqual([
      "roadmap.pdf",
    ]);
    expect(await names({ kind: "all", folderId: null })).toEqual([]);
    expect(await names({ kind: "all" })).toEqual(["roadmap.pdf"]);
    expect(
      await names({ kind: "all", folderId: null, search: "road" }),
    ).toEqual(["roadmap.pdf"]);
    expect(
      await names({
        kind: "all",
        folderId: null,
        search: "road",
        searchWithinFolder: true,
      }),
    ).toEqual([]);
    expect(
      await names({
        kind: "all",
        folderId: contracts,
        search: "road",
        searchWithinFolder: true,
      }),
    ).toEqual(["roadmap.pdf"]);
    expect(await owner.files.folders()).toEqual([
      expect.objectContaining({ name: "Contracts", files: 1, canManage: true }),
    ]);
  });

  it("lets only the folder's maker or a files manager change it", async () => {
    expect(
      (await member.files.folders()).find((f) => f.id === contracts)?.canManage,
    ).toBe(false);
    await expect(
      member.files.renameFolder({ id: contracts, name: "Mine now" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      member.files.deleteFolder({ id: contracts }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      member.files.moveFile({ id: roadmap, folderId: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const { id: theirs } = await member.files.createFolder({ name: "Drafts" });

    await expect(
      member.files.renameFolder({ id: theirs, name: "Drafts 2" }),
    ).resolves.toMatchObject({ id: theirs });
  });

  it("keeps other organizations' folders out of reach", async () => {
    const [foreign] = await outsider.files.folders();

    await expect(
      owner.files.moveFile({ id: roadmap, folderId: foreign!.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      owner.files.renameFolder({ id: foreign!.id, name: "Taken" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (await outsider.files.library({ kind: "all" })).map((file) => file.name),
    ).not.toContain("roadmap.pdf");
  });

  it("deleting a folder keeps its files, back at the top", async () => {
    await owner.files.deleteFolder({ id: contracts });

    const [file] = await db
      .select({ folderId: files.folderId, deletedAt: files.deletedAt })
      .from(files)
      .where(eq(files.id, roadmap));

    expect(file).toEqual({ folderId: null, deletedAt: null });
    expect((await owner.files.folders()).map((folder) => folder.name)).toEqual([
      "Drafts 2",
    ]);
  });

  it("needs Files rights to see or make folders", async () => {
    const org = await world.org("Folders denied");
    const m = await world.userIn(org, "member", "Denied Member");
    const denied = await world.caller(m.user, org);

    await world.override(org, m.user, "files.upload", "deny");
    await world.override(org, m.user, "files.view", "deny");

    await expect(
      denied.files.createFolder({ name: "Nope" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(denied.files.folders()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("needs Files rights to rename, delete or move, whoever made the folder", async () => {
    const org = await world.org("Folders rights");
    const m = await world.userIn(org, "member", "Rights Member");
    const member = await world.caller(m.user, org);
    const { id } = await member.files.createFolder({ name: "Mine" });
    const [file] = await db
      .insert(files)
      .values({
        organizationId: org.id,
        uploadedByMemberId: m.member.id,
        source: "library",
        name: "own.pdf",
        mimeType: "application/pdf",
        size: 10,
        storageKey: `${org.id}/rights-own.pdf`,
      })
      .returning();

    await world.override(org, m.user, "files.upload", "deny");
    await world.override(org, m.user, "files.delete_any", "deny");

    // A new request, so the new rights apply.
    const denied = await world.caller(m.user, org);

    await expect(
      denied.files.renameFolder({ id, name: "Still mine" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(denied.files.deleteFolder({ id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      denied.files.moveFile({ id: file!.id, folderId: id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("files a library upload straight into its folder, never another organization's", async () => {
    const org = await world.org("Folders upload");
    const o = await world.userIn(org, "owner", "Upload Owner");
    const uploader = await world.caller(o.user, org);
    const { id } = await uploader.files.createFolder({ name: "Inbox" });
    const [foreign] = await outsider.files.folders();
    const register = (key: string, folderId: string) =>
      uploader.files.libraryRegister({
        name: `${key}.txt`,
        mimeType: "text/plain",
        size: 5,
        storageKey: `${org.id}/${key}`,
        folderId,
      });

    await register("filed", id);
    expect(
      (await uploader.files.library({ kind: "all", folderId: id })).map(
        (f) => f.name,
      ),
    ).toEqual(["filed.txt"]);
    await expect(register("stray", foreign!.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // A chat upload is never filed in a library folder.
    const { id: chatFile } = await uploader.files.register({
      name: "chat.txt",
      mimeType: "text/plain",
      size: 5,
      storageKey: `${org.id}/chat-upload`,
      folderId: id,
    });
    const [stored] = await db
      .select({ folderId: files.folderId })
      .from(files)
      .where(eq(files.id, chatFile));

    expect(stored!.folderId).toBeNull();
  });
});
