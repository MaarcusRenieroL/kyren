import { randomUUID } from "node:crypto";
import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { activityEvents, users, verifications } from "@kyren/db/schema";
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

describe("authentication events", () => {
  it("records sign-up only for people who already belong to an organization", async () => {
    const org = await world.org("Signup");
    const email = `fresh-${randomUUID().slice(0, 8)}@example.test`;

    await call("/sign-up/email", { email, password, name: "New" });

    const [user] = await db.select().from(users).where(eq(users.email, email));

    world.trackUser(user!.id);
    // A brand new account is in no organization, so there is nowhere to write.
    expect(
      await db
        .select()
        .from(activityEvents)
        .where(eq(activityEvents.actorUserId, user!.id)),
    ).toHaveLength(0);
    expect(await eventsOf(org, "auth.")).toHaveLength(0);
  });

  it("records sign-in, failed sign-in and sign-out with request details", async () => {
    const org = await world.org("Signin");
    const { email, id } = await account(world, org);

    const wrong = await call("/sign-in/email", {
      email,
      password: "definitely-wrong-password",
    });

    expect(wrong.status).toBeGreaterThanOrEqual(400);

    const ok = await call("/sign-in/email", { email, password });

    expect(ok.status).toBe(200);

    const [failedEvent] = await eventsOf(org, "auth.sign_in_failed");
    const [signIn] = await eventsOf(org, "auth.sign_in");

    expect(failedEvent).toMatchObject({
      actorUserId: id,
      auditOnly: true,
      targetType: "session",
    });
    expect(signIn).toMatchObject({
      actorUserId: id,
      auditOnly: true,
      ip: "198.51.100.23",
      userAgent: "AuthTest/2.0",
    });
    expect(signIn!.requestId).toBeTruthy();
    // The password that was typed is stored nowhere.
    expect(JSON.stringify(await eventsOf(org, "auth."))).not.toContain(
      "definitely-wrong",
    );

    const out = await call(
      "/sign-out",
      {},
      clientHeaders({ cookie: cookieOf(ok) }),
    );

    expect(out.status).toBe(200);
    expect(await eventsOf(org, "auth.sign_out")).toHaveLength(1);
  });

  it("ignores failed sign-ins for accounts that do not exist", async () => {
    const org = await world.org("Unknown account");

    await account(world, org);
    await call("/sign-in/email", { email: "nobody@example.test", password });
    expect(await eventsOf(org, "auth.sign_in_failed")).toHaveLength(0);
  });

  it("records password change, reset request and reset without storing tokens", async () => {
    const org = await world.org("Passwords");
    const { email, id } = await account(world, org);
    const signedIn = await call("/sign-in/email", { email, password });
    const cookie = cookieOf(signedIn);
    const next = "Another-long-password-2";

    const changed = await call(
      "/change-password",
      { currentPassword: password, newPassword: next },
      clientHeaders({ cookie }),
    );

    expect(changed.status).toBe(200);
    expect(await eventsOf(org, "auth.password_changed")).toHaveLength(1);

    await call("/request-password-reset", {
      email,
      redirectTo: "/auth/reset-password",
    });
    expect(await eventsOf(org, "auth.password_reset_requested")).toHaveLength(
      1,
    );

    const [pending] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.value, id));
    const token = pending!.identifier.slice("reset-password:".length);

    const reset = await call("/reset-password", {
      newPassword: "Third-long-password-3",
      token,
    });

    expect(reset.status).toBe(200);

    const completed = await eventsOf(org, "auth.password_reset_completed");

    expect(completed).toHaveLength(1);
    expect(completed[0]!.actorUserId).toBe(id);
    expect(JSON.stringify(await eventsOf(org, "auth."))).not.toContain(token);
    expect(JSON.stringify(await eventsOf(org, "auth."))).not.toContain(
      "Another-long",
    );
  });

  it("records email verification", async () => {
    const org = await world.org("Verify");
    const { email } = await account(world, org);

    await call("/email-otp/send-verification-otp", {
      email,
      type: "email-verification",
    });

    const [row] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.identifier, `email-verification-otp-${email}`));
    const otp = row!.value.split(":")[0]!;
    const verified = await call("/email-otp/verify-email", { email, otp });

    expect(verified.status).toBe(200);
    expect(await eventsOf(org, "auth.email_verified")).toHaveLength(1);
    expect(JSON.stringify(await eventsOf(org, "auth."))).not.toContain(otp);
  });
});
