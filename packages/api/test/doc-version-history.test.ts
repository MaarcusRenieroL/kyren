import { db } from "@kyren/db";
import { eq, sql } from "@kyren/db/drizzle";
import { docVersions } from "@kyren/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { setupDocTest } from "./helpers/doc-setup";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("doc version history", () => {
  it("folds one person's burst of saves into a version holding the last text", async () => {
    const { doc, owner, admin } = await setupDocTest(world, "Versions burst");

    await owner.docs.updateDocContent({ id: doc.id, content: "draft 1" });
    await owner.docs.updateDocContent({ id: doc.id, content: "draft 2" });
    await owner.docs.updateDocContent({ id: doc.id, content: "draft 3" });
    await admin.docs.updateDocContent({ id: doc.id, content: "their take" });

    const history = await owner.docs.getVersionHistory({ id: doc.id });

    expect(history.map((version) => version.snippet)).toEqual([
      "their take",
      "draft 3",
    ]);
    expect(history[1]!.authorName).toBe("Owner");
  });

  it("starts a new version once the last one is older than the window", async () => {
    const { doc, owner } = await setupDocTest(world, "Versions window");

    await owner.docs.updateDocContent({ id: doc.id, content: "morning" });
    await db
      .update(docVersions)
      .set({ createdAt: sql`now() - interval '11 minutes'` })
      .where(eq(docVersions.docId, doc.id));
    await owner.docs.updateDocContent({ id: doc.id, content: "afternoon" });

    const history = await owner.docs.getVersionHistory({ id: doc.id });

    expect(history.map((version) => version.snippet)).toEqual([
      "afternoon",
      "morning",
    ]);
  });

  it("lists only versions, not comments or other activity", async () => {
    const { doc, owner } = await setupDocTest(world, "Versions only");

    await owner.docs.updateDocContent({ id: doc.id, content: "body" });
    await owner.docs.createComment({ docId: doc.id, body: "Looks good" });

    const history = await owner.docs.getVersionHistory({ id: doc.id });

    expect(history).toHaveLength(1);
    expect(history[0]!.snippet).toBe("body");
  });

  it("restores a version as a new one, and refuses a version of another doc", async () => {
    const { org, doc, owner } = await setupDocTest(world, "Versions restore");
    const other = await world.doc(org, { content: "elsewhere" });

    await owner.docs.updateDocContent({ id: other.id, content: "other text" });
    const first = await owner.docs.updateDocContent({
      id: doc.id,
      content: "keep me",
    });
    const [kept] = await owner.docs.getVersionHistory({ id: doc.id });
    const [foreign] = await owner.docs.getVersionHistory({ id: other.id });

    await expect(
      owner.docs.restoreVersion({
        id: doc.id,
        versionId: foreign!.id,
        expectedUpdatedAt: new Date(first.updatedAt),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // The mistake comes later, outside the window, as a version of its own.
    await db
      .update(docVersions)
      .set({ createdAt: sql`now() - interval '11 minutes'` })
      .where(eq(docVersions.id, kept!.id));
    const later = await owner.docs.updateDocContent({
      id: doc.id,
      content: "keep me, then a mistake",
    });
    const restored = await owner.docs.restoreVersion({
      id: doc.id,
      versionId: kept!.id,
      expectedUpdatedAt: new Date(later.updatedAt),
    });

    expect(restored.content).toBe("keep me");
    const history = await owner.docs.getVersionHistory({ id: doc.id });

    expect(history[0]!.snippet).toBe("keep me");
  });

  it("refuses a restore from someone who may not edit the doc", async () => {
    const { org, doc, owner, users } = await setupDocTest(
      world,
      "Versions restore denied",
    );
    const saved = await owner.docs.updateDocContent({
      id: doc.id,
      content: "agreed text",
    });
    const [version] = await owner.docs.getVersionHistory({ id: doc.id });

    await world.override(org, users.member, "docs.update_own", "deny");
    await world.override(org, users.member, "docs.update_any", "deny");
    const reader = await world.caller(users.member, org);

    await expect(
      reader.docs.restoreVersion({
        id: doc.id,
        versionId: version!.id,
        expectedUpdatedAt: new Date(saved.updatedAt),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Reading it is still fine.
    await expect(
      reader.docs.getVersion({ id: doc.id, versionId: version!.id }),
    ).resolves.toMatchObject({ content: "agreed text" });
  });

  it("does not restore into a doc in the trash", async () => {
    const { doc, owner } = await setupDocTest(world, "Versions trashed");
    const saved = await owner.docs.updateDocContent({
      id: doc.id,
      content: "before trash",
    });
    const [version] = await owner.docs.getVersionHistory({ id: doc.id });

    await owner.docs.delete({ id: doc.id });

    await expect(
      owner.docs.restoreVersion({
        id: doc.id,
        versionId: version!.id,
        expectedUpdatedAt: new Date(saved.updatedAt),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is closed to someone who cannot see the doc", async () => {
    const { org, doc, owner, users } = await setupDocTest(
      world,
      "Versions denied",
    );

    await owner.docs.updateDocContent({ id: doc.id, content: "secret" });
    await world.override(org, users.member, "docs.view", "deny");

    const member = await world.caller(users.member, org);

    const [version] = await owner.docs.getVersionHistory({ id: doc.id });

    await expect(
      member.docs.getVersionHistory({ id: doc.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      member.docs.getVersion({ id: doc.id, versionId: version!.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
