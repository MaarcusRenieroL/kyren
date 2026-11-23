import { db } from "@kyren/db";
import { and, eq } from "@kyren/db/drizzle";
import {
  invitations,
  members,
  organizations,
  users,
} from "@kyren/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { callAuth as call } from "./helpers/auth-call";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("invitations addressed to someone else", () => {
  it("cannot be accepted or rejected by another user", async () => {
    const org = await world.org("Invites");
    const owner = await world.userIn(org, "owner");
    const invited = await world.user("Invited");
    const thief = await world.user("Thief");
    const invitation = await world.invitation(org, owner.user, {
      email: invited.email,
      role: "admin",
    });

    const accepted = await call(
      await world.sessionHeaders(thief),
      "POST",
      "/organization/accept-invitation",
      { invitationId: invitation.id },
    );
    const rejected = await call(
      await world.sessionHeaders(thief),
      "POST",
      "/organization/reject-invitation",
      { invitationId: invitation.id },
    );

    expect(accepted.status).toBeGreaterThanOrEqual(400);
    expect(rejected.status).toBeGreaterThanOrEqual(400);
    expect(
      await db.select().from(members).where(eq(members.userId, thief.id)),
    ).toHaveLength(0);

    const [row] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitation.id));

    expect(row?.status).toBe("pending");
  });

  it("can be accepted by the invited user, with exactly the invited role", async () => {
    const org = await world.org("Invites ok");
    const owner = await world.userIn(org, "owner");
    const invited = await world.user("Invited");
    const invitation = await world.invitation(org, owner.user, {
      email: invited.email,
      role: "member",
    });

    const response = await call(
      await world.sessionHeaders(invited),
      "POST",
      "/organization/accept-invitation",
      { invitationId: invitation.id },
    );

    expect(response.status).toBe(200);

    const [member] = await db
      .select()
      .from(members)
      .where(
        and(eq(members.userId, invited.id), eq(members.organizationId, org.id)),
      );

    expect(member?.role).toBe("member");
  });

  it("is not accepted twice, nor after it was rejected", async () => {
    const org = await world.org("Invites once");
    const owner = await world.userIn(org, "owner");
    const invited = await world.user("Invited");
    const invitation = await world.invitation(org, owner.user, {
      email: invited.email,
    });
    const headers = await world.sessionHeaders(invited);

    expect(
      (
        await call(headers, "POST", "/organization/reject-invitation", {
          invitationId: invitation.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(headers, "POST", "/organization/accept-invitation", {
          invitationId: invitation.id,
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      await db.select().from(members).where(eq(members.userId, invited.id)),
    ).toHaveLength(0);
  });

  it("an unverified address cannot accept", async () => {
    const org = await world.org("Invites unverified");
    const owner = await world.userIn(org, "owner");
    const invited = await world.user("Unverified");

    await db
      .update(users)
      .set({ emailVerified: false })
      .where(eq(users.id, invited.id));

    const invitation = await world.invitation(org, owner.user, {
      email: invited.email,
    });
    const response = await call(
      await world.sessionHeaders(invited),
      "POST",
      "/organization/accept-invitation",
      { invitationId: invitation.id },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(
      await db.select().from(members).where(eq(members.userId, invited.id)),
    ).toHaveLength(0);
  });
});

describe("core endpoints cannot change roles or memberships", () => {
  it("update-user ignores a role and other protected fields", async () => {
    const org = await world.org("Update user");
    const member = await world.userIn(org, "member");
    const headers = await world.sessionHeaders(member.user, org);

    await call(headers, "POST", "/update-user", {
      name: "Renamed",
      role: "owner",
      emailVerified: false,
    });

    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, member.user.id));
    const [membership] = await db
      .select()
      .from(members)
      .where(eq(members.id, member.member.id));

    expect(row?.role).toBe("member");
    expect(row?.emailVerified).toBe(true);
    expect(membership?.role).toBe("member");
  });

  it("sign-up cannot choose a role", async () => {
    const response = await call(new Headers(), "POST", "/sign-up/email", {
      email: `signup-${Math.random().toString(36).slice(2, 10)}@example.test`,
      password: "a-long-enough-password",
      name: "New Person",
      role: "owner",
    });
    const body = (await response.json()) as { user?: { id: string } };

    if (body.user) {
      world.trackUser(body.user.id);

      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, body.user.id));

      expect(row?.role).toBe("member");
    } else {
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
  });

  it("deleting an account is not offered", async () => {
    const org = await world.org("Delete user");
    const owner = await world.userIn(org, "owner");
    const response = await call(
      await world.sessionHeaders(owner.user, org),
      "POST",
      "/delete-user",
      {},
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(
      await db.select().from(users).where(eq(users.id, owner.user.id)),
    ).toHaveLength(1);
  });
});
