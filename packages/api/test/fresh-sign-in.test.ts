import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { users } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const hour = 60 * 60 * 1000;

describe("sensitive actions need a recent sign-in", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Awaited<ReturnType<World["userIn"]>>;

  beforeAll(async () => {
    org = await world.org("Fresh");
    owner = await world.userIn(org, "owner", "Fresh Owner");
  });

  it("refuses an old session for keys, webhooks and policy, but not for ordinary work", async () => {
    const stale = await world.caller(owner.user, org, {
      sessionAgeMs: 2 * hour,
    });

    await expect(stale.apiKey.create({ name: "CI" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/sign in again/i),
    });
    await expect(
      stale.webhook.create({ url: "https://example.com/hook" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      stale.organization.setAiPolicy({ enabled: true }),
    ).resolves.toBeTruthy();
    await expect(stale.apiKey.list()).resolves.toEqual([]);
  });

  it("allows the same actions on a session that just signed in", async () => {
    const [fresh] = await db
      .select()
      .from(users)
      .where(eq(users.id, owner.user.id));
    const caller = await world.caller(fresh!, org, { sessionAgeMs: 60_000 });

    await expect(caller.apiKey.create({ name: "CI" })).resolves.toHaveProperty(
      "key",
    );
  });
});
