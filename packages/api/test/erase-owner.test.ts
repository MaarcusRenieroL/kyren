import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { and, eq } from "@kyren/db/drizzle";
import {
  apiKeys,
  members,
  permissionOverrides,
  roleAssignments,
} from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("erasing someone", () => {
  it("an admin cannot erase an owner; another owner can", async () => {
    const org = await world.org("Erase owner");
    const first = await world.userIn(org, "owner", "First owner");
    const second = await world.userIn(org, "owner", "Second owner");
    const a = await world.userIn(org, "admin", "Admin");
    const admin = await world.caller(a.user, org);
    const owner = await world.caller(first.user, org);

    await expect(
      admin.privacy.erase({ memberId: second.member.id, redactContent: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.privacy.erase({ memberId: second.member.id, redactContent: false }),
    ).resolves.toBeDefined();
  });

  it("needs a recent sign-in", async () => {
    const org = await world.org("Erase fresh");
    const o = await world.userIn(org, "owner", "Owner");
    const m = await world.userIn(org, "member", "Member");
    const stale = await world.caller(o.user, org, {
      sessionAgeMs: 2 * 60 * 60 * 1000,
    });

    await expect(
      stale.privacy.erase({ memberId: m.member.id, redactContent: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("removes their roles, overrides and API keys so a new invite starts clean", async () => {
    const org = await world.org("Erase access");
    const o = await world.userIn(org, "owner", "Owner");
    // In another organization too, so the account itself is kept.
    const other = await world.org("Erase access elsewhere");
    const m = await world.userIn(org, "member", "Leaving");

    await world.member(other, m.user, "member");

    const role = await world.role(org, {
      name: "Extra",
      permissions: ["admin.view"],
    });

    await world.assign(
      org,
      role.id,
      { type: "user", id: m.user.id },
      { type: "organization", id: org.id },
    );
    await world.override(org, m.user, "payroll.view", "allow");
    await db.insert(apiKeys).values({
      organizationId: org.id,
      createdByUserId: m.user.id,
      name: "CI",
      prefix: "zk_test",
      keyHash: randomUUID(),
    });

    const owner = await world.caller(o.user, org);

    await owner.privacy.erase({ memberId: m.member.id, redactContent: false });

    expect(
      await db
        .select()
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.organizationId, org.id),
            eq(roleAssignments.principalId, m.user.id),
          ),
        ),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(permissionOverrides)
        .where(
          and(
            eq(permissionOverrides.organizationId, org.id),
            eq(permissionOverrides.userId, m.user.id),
          ),
        ),
    ).toHaveLength(0);

    const [key] = await db
      .select({ revokedAt: apiKeys.revokedAt })
      .from(apiKeys)
      .where(eq(apiKeys.createdByUserId, m.user.id));

    expect(key!.revokedAt).not.toBeNull();
    expect(
      await db.select().from(members).where(eq(members.userId, m.user.id)),
    ).toHaveLength(1);
  });
});
