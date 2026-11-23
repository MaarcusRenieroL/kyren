import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isNewDevice } from "@kyren/auth";
import { insertActivityEvent } from "@kyren/audit/server";
import { db } from "@kyren/db";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("a sign-in from an unfamiliar browser is worth an alert", () => {
  let userId: string;
  let organizationId: string;

  const signedIn = (userAgent: string) =>
    insertActivityEvent(db, {
      organizationId,
      actorUserId: userId,
      action: "auth.sign_in",
      target: { id: userId, label: "Someone" },
      request: { ip: "203.0.113.5", userAgent, requestId: crypto.randomUUID() },
    });

  beforeAll(async () => {
    const org = await world.org("Devices");
    const person = await world.userIn(org, "member", "Device Person");

    userId = person.user.id;
    organizationId = org.id;
  });

  it("stays quiet on the very first sign-in, when there is nothing to compare", async () => {
    expect(await isNewDevice(userId, "Chrome/130")).toBe(false);
  });

  it("stays quiet for a browser seen before and speaks for a new one", async () => {
    await signedIn("Chrome/130");

    expect(await isNewDevice(userId, "Chrome/130")).toBe(false);
    expect(await isNewDevice(userId, "Firefox/140")).toBe(true);
  });

  it("treats a missing browser name as unknown, not as new", async () => {
    expect(await isNewDevice(userId, null)).toBe(false);
  });
});
