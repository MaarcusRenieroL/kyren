import { randomUUID } from "node:crypto";
import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { activityEvents, users } from "@kyren/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import {
  account,
  call,
  clientHeaders,
  cookieOf,
  eventsOf,
  password,
} from "./helpers/auth-events-helpers";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("membership events from Better Auth", () => {
  it("records an accepted invitation and the member joining", async () => {
    const org = await world.org("Accept");
    const owner = await world.userIn(org, "owner");
    const { email, id } = await (async () => {
      const mail = `inv-${randomUUID().slice(0, 8)}@example.test`;
      await call("/sign-up/email", {
        email: mail,
        password,
        name: "Invitee Person",
      });
      const [user] = await db.select().from(users).where(eq(users.email, mail));

      world.trackUser(user!.id);
      await db
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, user!.id));

      return { email: mail, id: user!.id };
    })();
    const invitation = await world.invitation(org, owner.user, {
      email,
      role: "member",
    });
    const signedIn = await call("/sign-in/email", { email, password });
    const accepted = await call(
      "/organization/accept-invitation",
      { invitationId: invitation.id },
      clientHeaders({ cookie: cookieOf(signedIn) }),
    );

    expect(accepted.status).toBe(200);
    expect((await eventsOf(org, "invitation.accepted"))[0]).toMatchObject({
      actorUserId: id,
      targetId: invitation.id,
      targetLabel: email,
      auditOnly: true,
    });
    expect((await eventsOf(org, "member.joined"))[0]).toMatchObject({
      actorUserId: id,
      targetLabel: "Invitee Person",
      auditOnly: false,
    });
  });

  it("records a rejected invitation", async () => {
    const org = await world.org("Reject");
    const owner = await world.userIn(org, "owner");
    const mail = `rej-${randomUUID().slice(0, 8)}@example.test`;

    await call("/sign-up/email", { email: mail, password, name: "Rejecter" });

    const [user] = await db.select().from(users).where(eq(users.email, mail));

    world.trackUser(user!.id);
    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, user!.id));

    const invitation = await world.invitation(org, owner.user, { email: mail });
    const signedIn = await call("/sign-in/email", { email: mail, password });

    await call(
      "/organization/reject-invitation",
      { invitationId: invitation.id },
      clientHeaders({ cookie: cookieOf(signedIn) }),
    );
    expect((await eventsOf(org, "invitation.rejected"))[0]).toMatchObject({
      targetId: invitation.id,
    });
  });

  it("records leaving an organization and creating one", async () => {
    const org = await world.org("Leave");

    await world.userIn(org, "owner");

    const { email, id } = await account(world, org);
    const signedIn = await call("/sign-in/email", { email, password });
    const cookie = cookieOf(signedIn);

    const left = await call(
      "/organization/leave",
      { organizationId: org.id },
      clientHeaders({ cookie }),
    );

    expect(left.status).toBe(200);
    expect((await eventsOf(org, "member.left"))[0]).toMatchObject({
      actorUserId: id,
      targetLabel: "Auth Person",
    });

    const created = await call(
      "/organization/create",
      { name: "Created via hook", slug: `hook-${randomUUID().slice(0, 8)}` },
      clientHeaders({ cookie }),
    );
    const body = (await created.json()) as { id: string };

    world.trackOrg(body.id);
    expect(created.status).toBe(200);
    expect(
      (
        await db
          .select()
          .from(activityEvents)
          .where(eq(activityEvents.organizationId, body.id))
      ).map((event) => event.action),
    ).toContain("org.created");
  });
});
