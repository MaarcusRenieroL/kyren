import { afterAll, describe, expect, it } from "vitest";

import { apiKeyCaller } from "../src/server/api-context";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("a call made with an API key", () => {
  it("never counts as a recent sign-in", async () => {
    const org = await world.org("Key freshness");
    const o = await world.userIn(org, "owner", "Owner");
    const m = await world.userIn(org, "member", "Member");
    const caller = await apiKeyCaller(
      { keyId: "k", organizationId: org.id, user: o.user as never },
      new Headers(),
    );

    await expect(
      caller!.privacy.erase({ memberId: m.member.id, redactContent: false }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/sign in again/i),
    });
  });
});
