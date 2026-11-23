import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { organizations } from "@kyren/db/schema";

import { publicArticle } from "../src/server/kb-public";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("help article trash", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let orgSlug: string;

  beforeAll(async () => {
    const org = await world.org("Article trash");

    const [row] = await db
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, org.id));

    orgSlug = row!.slug;

    const o = await world.userIn(org, "owner", "Trash Owner");
    const m = await world.userIn(org, "member", "Trash Member");
    const other = await world.org("Article trash elsewhere");
    const x = await world.userIn(other, "owner", "Trash Outsider");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
  });

  const publish = (title: string) =>
    owner.kb.save({
      title,
      body: "Steps",
      status: "published",
      audience: "public",
    });

  it("moves an article to the trash and brings it back as it was", async () => {
    const article = await publish("Change your email");

    await owner.kb.remove({ id: article.id });

    expect((await owner.kb.list({})).map((a) => a.id)).not.toContain(
      article.id,
    );
    expect(await publicArticle(db, orgSlug, article.slug)).toBeNull();
    expect((await owner.kb.trash({})).map((a) => a.id)).toContain(article.id);
    // A trashed article takes no edits until it is restored.
    await expect(
      owner.kb.save({
        id: article.id,
        title: "Edited in the trash",
        body: "x",
        status: "published",
        audience: "public",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await owner.kb.untrash({ id: article.id });

    expect(await publicArticle(db, orgSlug, article.slug)).toMatchObject({
      title: "Change your email",
    });
    expect((await owner.kb.trash({})).map((a) => a.id)).not.toContain(
      article.id,
    );
  });

  it("deletes for good only from the trash", async () => {
    const article = await publish("Close your account");

    await expect(owner.kb.purge({ id: article.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await owner.kb.remove({ id: article.id });
    await owner.kb.purge({ id: article.id });

    expect((await owner.kb.trash({})).map((a) => a.id)).not.toContain(
      article.id,
    );
    await expect(owner.kb.untrash({ id: article.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets only article managers in this organization use the trash", async () => {
    const article = await publish("Export your data");

    await owner.kb.remove({ id: article.id });

    for (const call of [
      () => member.kb.trash({}),
      () => member.kb.untrash({ id: article.id }),
      () => member.kb.purge({ id: article.id }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }

    await expect(outsider.kb.untrash({ id: article.id })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    await expect(outsider.kb.purge({ id: article.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await outsider.kb.trash({})).map((a) => a.id)).not.toContain(
      article.id,
    );
  });
});
