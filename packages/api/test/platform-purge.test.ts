import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { files, organizations } from "@kyren/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { purgeScheduledOrganizations } from "../src/server/platform-purge";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("platform purge", () => {
  it("removes the uploaded bytes of a purged organization", async () => {
    const org = await world.org("Files Co");
    const owner = await world.userIn(org, "owner", "Files Owner");
    const removed: string[] = [];

    await db.insert(files).values({
      organizationId: org.id,
      uploadedByMemberId: owner.member.id,
      name: "a.png",
      mimeType: "image/png",
      size: 10,
      storageKey: `${org.id}/a.png`,
    });
    await db
      .update(organizations)
      .set({ deletionScheduledFor: new Date(Date.now() - 1000) })
      .where(eq(organizations.id, org.id));

    await expect(
      purgeScheduledOrganizations(db, {
        removeFiles: async (keys) => {
          removed.push(...keys);
        },
      }),
    ).resolves.toBe(1);
    expect(removed).toEqual([`${org.id}/a.png`]);
  });

  it("still purges when removing the bytes fails", async () => {
    const org = await world.org("Flaky Files Co");

    await db
      .update(organizations)
      .set({ deletionScheduledFor: new Date(Date.now() - 1000) })
      .where(eq(organizations.id, org.id));
    await world.userIn(org, "owner", "Flaky Owner");

    await expect(
      purgeScheduledOrganizations(db, {
        removeFiles: async () => {
          throw new Error("storage down");
        },
      }),
    ).resolves.toBe(1);
  });
});
