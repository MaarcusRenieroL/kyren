import { afterAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { members } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("memberships", () => {
  it("lets a person join an organization once", async () => {
    const org = await world.org("Once only");
    const { user } = await world.userIn(org, "member", "Single Member");

    // Two accepted invitations racing would try exactly this.
    await expect(
      db.insert(members).values({
        organizationId: org.id,
        userId: user.id,
        role: "member",
      }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});
