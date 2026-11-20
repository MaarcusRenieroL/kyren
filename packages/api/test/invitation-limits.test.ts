import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("invitation email limits", () => {
  it("stops a fourth invitation to the same address in a day, from any organization", async () => {
    const target = `bombed.${crypto.randomUUID()}@example.test`;
    const callers = [];

    for (const label of ["One", "Two", "Three", "Four"]) {
      const org = await world.org(`Invite limit ${label}`);
      const owner = await world.userIn(org, "owner", `Owner ${label}`);

      callers.push(await world.caller(owner.user, org));
    }

    for (const caller of callers.slice(0, 3)) {
      await expect(
        caller.invitation.invite({ email: target, role: "member" }),
      ).resolves.toBeDefined();
    }

    await expect(
      callers[3]!.invitation.invite({ email: target, role: "member" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("counts resends against the same limit", async () => {
    const target = `resent.${crypto.randomUUID()}@example.test`;
    const org = await world.org("Invite resend limit");
    const owner = await world.caller(
      (await world.userIn(org, "owner", "Resend Owner")).user,
      org,
    );
    const invitation = await owner.invitation.invite({
      email: target,
      role: "member",
    });

    await owner.invitation.resend({ invitationId: invitation.id });
    await owner.invitation.resend({ invitationId: invitation.id });
    await expect(
      owner.invitation.resend({ invitationId: invitation.id }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
