import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { organizations } from "@zentro/db/schema";

import { publicArticle, publicArticles } from "../src/server/kb-public";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("knowledge base", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let orgSlug: string;
  let otherSlug: string;

  beforeAll(async () => {
    const org = await world.org("Help");
    const o = await world.userIn(org, "owner", "Help Owner");
    const m = await world.userIn(org, "member", "Help Member");
    const other = await world.org("Help elsewhere");
    const x = await world.userIn(other, "owner", "Help Outsider");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);

    const [a] = await db
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, org.id));
    const [b] = await db
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, other.id));

    orgSlug = a!.slug;
    otherSlug = b!.slug;
  });

  it("lets only people who manage articles write them, while others can read", async () => {
    await expect(
      member.kb.save({
        title: "Sneaky",
        body: "x",
        status: "published",
        audience: "public",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await owner.kb.save({
      title: "How to reset your password",
      body: "Open Settings, choose Security, then Reset password.",
      status: "published",
      audience: "public",
    });

    expect((await member.kb.list({})).map((a) => a.title)).toEqual([
      "How to reset your password",
    ]);
  });

  it("gives each article a readable address and keeps repeated titles apart", async () => {
    await owner.kb.save({
      title: "How to reset your password",
      body: "Second copy",
      status: "draft",
      audience: "public",
    });

    expect((await owner.kb.list({})).map((a) => a.slug).sort()).toEqual([
      "how-to-reset-your-password",
      "how-to-reset-your-password-2",
    ]);
  });

  it("shows the public help centre only published public articles of that organisation", async () => {
    await owner.kb.save({
      title: "Staff handbook",
      body: "Internal only",
      status: "published",
      audience: "internal",
    });

    const articles = await publicArticles(db, orgSlug);

    expect(articles!.map((a) => a.title)).toEqual([
      "How to reset your password",
    ]);
    expect(Object.keys(articles![0]!).sort()).toEqual(
      ["slug", "title", "updatedAt"].sort(),
    );

    const article = await publicArticle(
      db,
      orgSlug,
      "how-to-reset-your-password",
    );

    expect(article!.body).toContain("Reset password");
    expect(await publicArticle(db, orgSlug, "staff-handbook")).toBeNull();
    expect(
      await publicArticle(db, orgSlug, "how-to-reset-your-password-2"),
    ).toBeNull();
    expect(
      await publicArticle(db, otherSlug, "how-to-reset-your-password"),
    ).toBeNull();
    expect(await publicArticles(db, "no-such-org")).toBeNull();
  });

  it("suggests published articles for a question, internal ones included, drafts never", async () => {
    const found = await member.kb.suggest({ query: "Staff handbook" });

    expect(found.map((a) => a.title)).toEqual(["Staff handbook"]);
    expect(
      (await member.kb.suggest({ query: "reset password" })).map((a) => a.slug),
    ).toEqual(["how-to-reset-your-password"]);
    expect(await member.kb.suggest({ query: "Second copy" })).toEqual([]);
    expect(await member.kb.suggest({ query: "%" })).toEqual([]);
  });

  it("edits and removes articles, only inside the organisation", async () => {
    const [first] = (await owner.kb.list({})).filter(
      (a) => a.slug === "how-to-reset-your-password",
    );

    await owner.kb.save({
      id: first!.id,
      title: "Reset your password",
      body: "Updated steps",
      status: "published",
      audience: "public",
    });
    expect(
      (await publicArticle(db, orgSlug, "how-to-reset-your-password"))!.body,
    ).toBe("Updated steps");

    await expect(
      outsider.kb.save({
        id: first!.id,
        title: "Hijack",
        body: "x",
        status: "published",
        audience: "public",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(outsider.kb.remove({ id: first!.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await owner.kb.remove({ id: first!.id });
    expect(await publicArticle(db, orgSlug, "how-to-reset-your-password")).toBe(
      null,
    );
  });

  it("limits title and body length", async () => {
    await expect(
      owner.kb.save({
        title: "T".repeat(151),
        body: "x",
        status: "draft",
        audience: "internal",
      }),
    ).rejects.toBeDefined();
    await expect(
      owner.kb.save({
        title: "Long",
        body: "x".repeat(20_001),
        status: "draft",
        audience: "internal",
      }),
    ).rejects.toBeDefined();
  });
});
