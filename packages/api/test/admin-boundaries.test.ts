import { afterAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { invitations, users } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("admin boundaries", () => {
  it("an admin cannot change another admin's role; an owner can", async () => {
    const org = await world.org("Admin peers");
    const o = await world.userIn(org, "owner", "Owner");
    const a = await world.userIn(org, "admin", "Admin A");
    const b = await world.userIn(org, "admin", "Admin B");
    const m = await world.userIn(org, "member", "Member");
    const adminA = await world.caller(a.user, org);
    const owner = await world.caller(o.user, org);

    await expect(
      adminA.member.updateRole({ memberId: b.member.id, role: "member" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      adminA.member.updateRole({ memberId: m.member.id, role: "admin" }),
    ).resolves.toBeDefined();
    await expect(
      owner.member.updateRole({ memberId: b.member.id, role: "member" }),
    ).resolves.toBeDefined();
  });

  it("an answered invitation cannot be resent", async () => {
    const org = await world.org("Invite resend");
    const o = await world.userIn(org, "owner", "Owner");
    const owner = await world.caller(o.user, org);
    const invite = await owner.invitation.invite({
      email: `${crypto.randomUUID()}@example.test`,
      role: "member",
    });

    await db
      .update(invitations)
      .set({ status: "canceled" })
      .where(eq(invitations.id, invite.id));

    await expect(
      owner.invitation.resend({ invitationId: invite.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("an unverified account sees no invitations for its address", async () => {
    const org = await world.org("Invite listing");
    const o = await world.userIn(org, "owner", "Owner");
    const owner = await world.caller(o.user, org);
    const squatter = await world.user("Squatter");

    await owner.invitation.invite({ email: squatter.email, role: "member" });
    await db
      .update(users)
      .set({ emailVerified: false })
      .where(eq(users.id, squatter.id));

    const unverified = world.sessionCaller({
      ...squatter,
      emailVerified: false,
    });

    expect(await unverified.user.listPendingInvites()).toEqual([]);

    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, squatter.id));

    const verified = world.sessionCaller({ ...squatter, emailVerified: true });

    expect((await verified.user.listPendingInvites()).length).toBe(1);
  });
});
