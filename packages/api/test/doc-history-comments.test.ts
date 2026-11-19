import { db } from "@zentro/db";
import { and, eq, sql } from "@zentro/db/drizzle";
import { activityEvents, docVersions } from "@zentro/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

async function setup(label: string) {
  const org = await world.org(label);
  const o = await world.userIn(org, "owner", "Owner");
  const a = await world.userIn(org, "admin", "Admin");
  const m = await world.userIn(org, "member", "Member");
  const doc = await world.doc(org, { content: "start" });

  return {
    org,
    doc,
    users: { owner: o.user, admin: a.user, member: m.user },
    owner: await world.caller(o.user, org),
    admin: await world.caller(a.user, org),
    member: await world.caller(m.user, org),
  };
}

describe("doc version history", () => {
  it("folds one person's burst of saves into a version holding the last text", async () => {
    const { doc, owner, admin } = await setup("Versions burst");

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
    const { doc, owner } = await setup("Versions window");

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
    const { doc, owner } = await setup("Versions only");

    await owner.docs.updateDocContent({ id: doc.id, content: "body" });
    await owner.docs.createComment({ docId: doc.id, body: "Looks good" });

    const history = await owner.docs.getVersionHistory({ id: doc.id });

    expect(history).toHaveLength(1);
    expect(history[0]!.snippet).toBe("body");
  });

  it("restores a version as a new one, and refuses a version of another doc", async () => {
    const { org, doc, owner } = await setup("Versions restore");
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
    const { org, doc, owner, users } = await setup("Versions restore denied");
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
    const { doc, owner } = await setup("Versions trashed");
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
    const { org, doc, owner, users } = await setup("Versions denied");

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

describe("doc comments", () => {
  it("lets the author edit their comment, and nobody else", async () => {
    const { doc, member, admin } = await setup("Comment edit");
    const comment = await member.docs.createComment({
      docId: doc.id,
      body: "Typo in the intro",
    });

    await expect(
      member.docs.editComment({ id: comment.id, body: "Typo in section 2" }),
    ).resolves.toMatchObject({ body: "Typo in section 2" });
    await expect(
      admin.docs.editComment({ id: comment.id, body: "I never said that" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const [listed] = await admin.docs.getComments({ docId: doc.id });

    expect(listed!.body).toBe("Typo in section 2");
  });

  it("lets the author or a doc moderator delete it, and hides it afterwards", async () => {
    const { org, doc, owner, member, users } = await setup("Comment delete");
    const mine = await owner.docs.createComment({
      docId: doc.id,
      body: "Owner note",
    });
    const theirs = await member.docs.createComment({
      docId: doc.id,
      body: "Member note",
    });

    // A member who may not edit every doc cannot remove others' comments.
    await world.override(org, users.member, "docs.update_any", "deny");
    const restricted = await world.caller(users.member, org);

    await expect(
      restricted.docs.deleteComment({ id: mine.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      restricted.docs.deleteComment({ id: theirs.id }),
    ).resolves.toEqual({ id: theirs.id });
    await expect(owner.docs.deleteComment({ id: mine.id })).resolves.toEqual({
      id: mine.id,
    });

    expect(await owner.docs.getComments({ docId: doc.id })).toEqual([]);
    await expect(
      member.docs.editComment({ id: theirs.id, body: "back again" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const deletions = await db
      .select({ id: activityEvents.id })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.organizationId, org.id),
          eq(activityEvents.action, "doc.comment_deleted"),
        ),
      );

    expect(deletions).toHaveLength(2);
  });

  it("refuses edits and deletes from someone who may not comment", async () => {
    const { org, doc, member, users } = await setup("Comment denied");
    const comment = await member.docs.createComment({
      docId: doc.id,
      body: "Before",
    });

    await world.override(org, users.member, "docs.comment", "deny");
    const silenced = await world.caller(users.member, org);

    await expect(
      silenced.docs.editComment({ id: comment.id, body: "After" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      silenced.docs.deleteComment({ id: comment.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("doc comment threads", () => {
  it("keeps replies under their thread, and a reply reopens a resolved one", async () => {
    const { doc, owner, member } = await setup("Comment threads");
    const thread = await owner.docs.createComment({
      docId: doc.id,
      body: "Is the date right?",
    });

    await owner.docs.resolveComment({ id: thread.id });

    const reply = await member.docs.createComment({
      docId: doc.id,
      body: "It moved to Friday.",
      parentId: thread.id,
    });
    const comments = await owner.docs.getComments({ docId: doc.id });

    expect(comments.map((c) => [c.body, c.parentId])).toEqual([
      ["Is the date right?", null],
      ["It moved to Friday.", thread.id],
    ]);
    expect(comments[0]!.resolvedAt).toBeNull();

    // Replies never nest, and a reply is not a thread to resolve.
    await expect(
      owner.docs.createComment({
        docId: doc.id,
        body: "Deeper",
        parentId: reply.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.docs.resolveComment({ id: reply.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses replies to another doc's or another organization's comments", async () => {
    const { org, doc, owner } = await setup("Comment threads elsewhere");
    const otherDoc = await world.doc(org, { content: "second" });
    const elsewhere = await owner.docs.createComment({
      docId: otherDoc.id,
      body: "On the other doc",
    });

    await expect(
      owner.docs.createComment({
        docId: doc.id,
        body: "Cross-doc",
        parentId: elsewhere.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const stranger = await setup("Comment threads stranger");
    const foreign = await stranger.owner.docs.createComment({
      docId: stranger.doc.id,
      body: "Theirs",
    });

    await expect(
      owner.docs.createComment({
        docId: doc.id,
        body: "Cross-org",
        parentId: foreign.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("takes the replies with a deleted thread", async () => {
    const { doc, owner, member } = await setup("Comment thread delete");
    const thread = await member.docs.createComment({
      docId: doc.id,
      body: "Typo here",
    });

    await owner.docs.createComment({
      docId: doc.id,
      body: "Fixed",
      parentId: thread.id,
    });
    await member.docs.deleteComment({ id: thread.id });

    expect(await owner.docs.getComments({ docId: doc.id })).toEqual([]);
  });

  it("never leaves a live reply under a thread deleted at the same moment", async () => {
    const { doc, owner, member } = await setup("Comment thread race");

    for (let round = 0; round < 5; round += 1) {
      const thread = await owner.docs.createComment({
        docId: doc.id,
        body: `Thread ${round}`,
      });

      await Promise.allSettled([
        member.docs.createComment({
          docId: doc.id,
          body: `Reply ${round}`,
          parentId: thread.id,
        }),
        owner.docs.deleteComment({ id: thread.id }),
      ]);
    }

    expect(await owner.docs.getComments({ docId: doc.id })).toEqual([]);
  });
});
