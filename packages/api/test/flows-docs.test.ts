import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { docComments, docs } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reservedDocSlugs } from "../src/types/zod-schema";
import { World, type TestOrg } from "./helpers";

const world = new World();

type Caller = Awaited<ReturnType<World["caller"]>>;

let org: TestOrg;
let ownerMemberId: string;
let as: Caller;

beforeAll(async () => {
  org = await world.org("Flows-Docs");
  const created = await world.userIn(org, "owner", "Flow Doc Owner");

  ownerMemberId = created.member.id;
  as = await world.caller(created.user, org);
});

afterAll(() => world.cleanup());

describe("docs", () => {
  it("creates, reads and updates a doc", async () => {
    const doc = await as.docs.create({
      title: "Handbook",
      slug: "handbook-1",
      content: "# Hi",
    });

    expect(doc).toMatchObject({
      title: "Handbook",
      slug: "handbook-1",
      organizationId: org.id,
      createdByMemberId: ownerMemberId,
    });

    await as.docs.updateDocTitle({ id: doc.id, title: "Handbook v2" });
    await as.docs.updateDocContent({ id: doc.id, content: "# Updated" });

    const bySlug = await as.docs.getBySlug({ slug: "handbook-1" });

    expect(bySlug).toMatchObject({
      title: "Handbook v2",
      content: "# Updated",
    });
    expect((await as.docs.getById({ id: doc.id })).id).toBe(doc.id);
  });

  it("rejects reserved slugs at the API boundary", async () => {
    for (const slug of reservedDocSlugs) {
      await expect(
        as.docs.create({ title: "Reserved", slug }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("rejects duplicate slugs in one organization", async () => {
    await as.docs.create({ title: "One", slug: "dup-doc" });

    await expect(
      as.docs.create({ title: "Two", slug: "dup-doc" }),
    ).rejects.toBeDefined();
  });

  it("moves a doc to the trash and restores it", async () => {
    const doc = await as.docs.create({ title: "Trash me", slug: "trash-me" });

    await as.docs.delete({ id: doc.id });

    const visible = await as.docs.getAll({});
    const trashed = await as.docs.getAll({ includeDeleted: true });

    expect(visible.map((item) => item.id)).not.toContain(doc.id);
    expect(trashed.map((item) => item.id)).toContain(doc.id);

    await as.docs.restore({ id: doc.id });

    expect((await as.docs.getAll({})).map((item) => item.id)).toContain(doc.id);

    const [row] = await db.select().from(docs).where(eq(docs.id, doc.id));

    expect(row!.deletedAt).toBeNull();
  });

  it("searches by title", async () => {
    await as.docs.create({ title: "Quarterly roadmap", slug: "roadmap-q" });

    const found = await as.docs.search({ query: "roadmap" });

    expect(found.map((doc) => doc.slug)).toContain("roadmap-q");
  });

  it("adds, lists and resolves doc comments", async () => {
    const doc = await as.docs.create({ title: "Reviewed", slug: "reviewed" });

    await as.docs.createComment({ docId: doc.id, body: "Please clarify" });

    const [comment] = await as.docs.getComments({ docId: doc.id });

    expect(comment).toMatchObject({ body: "Please clarify" });

    await as.docs.resolveComment({ id: comment!.id });

    const [row] = await db
      .select()
      .from(docComments)
      .where(eq(docComments.id, comment!.id));

    expect(row!.resolvedAt).not.toBeNull();
  });
});
