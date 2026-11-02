import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("unverified email addresses", () => {
  it("cannot use organization data through the API", async () => {
    const org = await world.org("Unverified");
    const { user } = await world.userIn(org, "owner", "Unverified owner");
    const asUnverified = await world.caller(
      { ...user, emailVerified: false },
      org,
    );

    await expect(asUnverified.tickets.list({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("still works once the address is verified", async () => {
    const org = await world.org("Verified");
    const { user } = await world.userIn(org, "owner", "Verified owner");
    const asVerified = await world.caller(user, org);

    await expect(asVerified.tickets.list({})).resolves.toBeTruthy();
  });
});
