import { auth } from "@kyren/auth";
import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("an organization with more than 100 people", () => {
  it("accepts the 101st member and lists everyone", async () => {
    const org = await world.org("Big Co");
    const owner = await world.userIn(org, "owner", "Big Owner");

    // 99 more people: 100 members in all.
    for (let index = 0; index < 99; index += 1) {
      await world.member(org, await world.user(`Person ${index}`));
    }

    const newcomer = await world.user("Newcomer");
    const invitation = await world.invitation(org, owner.user, {
      email: newcomer.email,
    });

    await expect(
      auth.api.acceptInvitation({
        headers: await world.sessionHeaders(newcomer),
        body: { invitationId: invitation.id },
      }),
    ).resolves.toBeTruthy();

    const listed = await auth.api.listMembers({
      headers: await world.sessionHeaders(owner.user, org),
      query: { organizationId: org.id },
    });

    expect(listed.members).toHaveLength(101);
    expect(listed.members.map((member) => member.user.name)).toContain(
      "Newcomer",
    );
  });
});
