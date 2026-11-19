import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("help article revisions", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let memberUser: Awaited<ReturnType<World["userIn"]>>["user"];
  let articleId: string;

  beforeAll(async () => {
    org = await world.org("Revisions");
    await world.setModule(org, "tickets", true);

    const o = await world.userIn(org, "owner", "Article Writer");
    const m = await world.userIn(org, "member", "Article Reader");
    const other = await world.org("Revisions elsewhere");
    const x = await world.userIn(other, "owner", "Revision Outsider");

    await world.setModule(other, "tickets", true);
    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
    memberUser = m.user;

    const article = await owner.kb.save({
      title: "Reset your password",
      body: "Click Forgot password.",
      status: "published",
      audience: "public",
    });

    articleId = article.id;
  });

  it("keeps the earlier version on each real edit, and nothing for a save without changes", async () => {
    const current = (await owner.kb.list({})).find((a) => a.id === articleId)!;

    await owner.kb.save({
      id: articleId,
      title: current.title,
      body: current.body,
      status: "published",
      audience: "public",
    });
    expect(await owner.kb.revisions({ id: articleId })).toEqual([]);

    await owner.kb.save({
      id: articleId,
      title: "Reset your password",
      body: "Open Settings, then Security, then Reset.",
      status: "published",
      audience: "public",
    });

    const revisions = await member.kb.revisions({ id: articleId });

    expect(revisions).toEqual([
      expect.objectContaining({
        body: "Click Forgot password.",
        editedBy: "Article Writer",
      }),
    ]);
  });

  it("restores old text but keeps who can see the article as it is now", async () => {
    await owner.kb.save({
      id: articleId,
      title: "Reset your password",
      body: "Open Settings, then Security, then Reset.",
      status: "draft",
      audience: "internal",
    });

    const oldest = (await owner.kb.revisions({ id: articleId })).at(-1)!;

    expect(oldest.status).toBe("published");

    const restored = await owner.kb.restoreRevision({ revisionId: oldest.id });

    expect(restored).toMatchObject({
      body: "Click Forgot password.",
      status: "draft",
      audience: "internal",
    });

    // The text replaced by the restore is kept, so the restore can be undone.
    const [newest] = await owner.kb.revisions({ id: articleId });

    expect(newest!.body).toBe("Open Settings, then Security, then Reset.");
  });

  it("lets only article managers restore", async () => {
    const [revision] = await owner.kb.revisions({ id: articleId });

    await expect(
      member.kb.restoreRevision({ revisionId: revision!.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps revisions inside the organization", async () => {
    const [revision] = await owner.kb.revisions({ id: articleId });

    await expect(
      outsider.kb.revisions({ id: articleId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      outsider.kb.restoreRevision({ revisionId: revision!.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("needs the right to view tickets to read revisions", async () => {
    await world.override(org, memberUser, "tickets.view", "deny");

    const denied = await world.caller(memberUser, org);

    await expect(denied.kb.revisions({ id: articleId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
