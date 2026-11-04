import { afterAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { users } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const hour = 60 * 60 * 1000;

async function userWith(values: Partial<typeof users.$inferInsert>) {
  const created = await world.user("Operator");

  await db.update(users).set(values).where(eq(users.id, created.id));
  const [row] = await db.select().from(users).where(eq(users.id, created.id));

  return row!;
}

describe("the platform console guard", () => {
  it("shows ordinary members and anonymous callers nothing", async () => {
    const member = await userWith({ twoFactorEnabled: true });

    await expect(
      world.sessionCaller(member).platform.me(),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(world.anonymousCaller().platform.me()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses a platform admin until two-factor is on", async () => {
    const admin = await userWith({ role: "platform_admin" });

    await expect(
      world.sessionCaller(admin).platform.me(),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/two-factor/i),
    });
  });

  it("admits a platform admin with two-factor and a recent sign-in", async () => {
    const admin = await userWith({
      role: "platform_admin",
      twoFactorEnabled: true,
    });

    await expect(
      world.sessionCaller(admin).platform.me(),
    ).resolves.toMatchObject({
      id: admin.id,
    });
  });

  it("refuses a platform admin whose session is old", async () => {
    const admin = await userWith({
      role: "platform_admin",
      twoFactorEnabled: true,
    });

    await expect(
      world.sessionCaller(admin, { sessionAgeMs: 2 * hour }).platform.me(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
