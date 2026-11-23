import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { activityEvents } from "@zentro/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { setupDocTest } from "./helpers/doc-setup";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("doc comments", () => {
  it("lets the author edit their comment, and nobody else", async () => {
    const { doc, member, admin } = await setupDocTest(world, "Comment edit");
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
    const { org, doc, owner, member, users } = await setupDocTest(
      world,
      "Comment delete",
    );
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
    const { org, doc, member, users } = await setupDocTest(
      world,
      "Comment denied",
    );
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
    const { doc, owner, member } = await setupDocTest(
      world,
      "Comment threads",
    );
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
    const { org, doc, owner } = await setupDocTest(
      world,
      "Comment threads elsewhere",
    );
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

    const stranger = await setupDocTest(world, "Comment threads stranger");
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
    const { doc, owner, member } = await setupDocTest(
      world,
      "Comment thread delete",
    );
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
    const { doc, owner, member } = await setupDocTest(
      world,
      "Comment thread race",
    );

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
