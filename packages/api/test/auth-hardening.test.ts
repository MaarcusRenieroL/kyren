import { randomUUID } from "node:crypto";

import { auth } from "@zentro/auth";
import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { sessions, verifications } from "@zentro/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const baseUrl = "http://localhost:3000/api/auth";

function post(path: string, body: unknown) {
  return auth.handler(
    new Request(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("emailed one-time codes", () => {
  // Codes are only ever emailed to verify an address. Every other code path
  // would let someone sign in or reset a password without the second factor.
  it.each([
    "/sign-in/email-otp",
    "/forget-password/email-otp",
    "/email-otp/request-password-reset",
    "/email-otp/reset-password",
    "/email-otp/check-verification-otp",
    "/email-otp/request-email-change",
    "/email-otp/change-email",
  ])("%s is not reachable", async (path) => {
    const response = await post(path, {
      email: "someone@example.test",
      otp: "123456",
      type: "sign-in",
    });

    expect(response.status).toBe(404);
  });

  it("still lets a new account verify its address", async () => {
    const response = await post("/email-otp/send-verification-otp", {
      email: `${randomUUID()}@example.test`,
      type: "email-verification",
    });

    expect(response.status).not.toBe(404);
  });
});

describe("password reset", () => {
  it("signs the account out everywhere", async () => {
    const user = await world.user("Reset Me");

    await db.insert(sessions).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    await auth.api.requestPasswordReset({
      body: { email: user.email, redirectTo: "/auth/reset-password" },
    });

    const [token] = await db
      .select({ identifier: verifications.identifier })
      .from(verifications)
      .where(eq(verifications.value, user.id));

    expect(token).toBeDefined();

    await auth.api.resetPassword({
      body: {
        newPassword: "A-much-better-password-9",
        token: token!.identifier.replace(/^reset-password:/, ""),
      },
    });

    const left = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, user.id));

    expect(left).toHaveLength(0);
  });
});
