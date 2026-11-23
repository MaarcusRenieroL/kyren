import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { users } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("an organization can require two-factor sign-in", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Awaited<ReturnType<World["userIn"]>>;
  let member: Awaited<ReturnType<World["userIn"]>>;

  const as = async (who: typeof owner) => {
    const [fresh] = await db
      .select()
      .from(users)
      .where(eq(users.id, who.user.id));

    return world.caller(fresh!, org);
  };

  beforeAll(async () => {
    org = await world.org("Needs 2FA");
    owner = await world.userIn(org, "owner", "Policy Owner");
    member = await world.userIn(org, "member", "Policy Member");
  });

  it("will not switch on for an admin who has no two-factor themselves", async () => {
    await expect(
      (await as(owner)).organization.setTwoFactorPolicy({ required: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks members without two-factor once it is on, and lets the rest through", async () => {
    await db
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, owner.user.id));

    await (await as(owner)).organization.setTwoFactorPolicy({ required: true });

    await expect(
      (await as(member)).project.getProjectsByOrgId(),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/two-factor/i),
    });
    await expect(
      (await as(owner)).project.getProjectsByOrgId(),
    ).resolves.toBeTruthy();

    await db
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, member.user.id));

    await expect(
      (await as(member)).project.getProjectsByOrgId(),
    ).resolves.toBeTruthy();
  });

  it("stops blocking as soon as the requirement is turned off", async () => {
    await db
      .update(users)
      .set({ twoFactorEnabled: false })
      .where(eq(users.id, member.user.id));

    await expect(
      (await as(member)).project.getProjectsByOrgId(),
    ).rejects.toBeTruthy();

    await (
      await as(owner)
    ).organization.setTwoFactorPolicy({ required: false });

    await expect(
      (await as(member)).project.getProjectsByOrgId(),
    ).resolves.toBeTruthy();
  });

  it("only people who can change organization settings may set it", async () => {
    await expect(
      (await as(member)).organization.setTwoFactorPolicy({ required: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
