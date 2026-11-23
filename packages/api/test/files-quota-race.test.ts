import { db } from "@kyren/db";
import { and, eq, isNull } from "@kyren/db/drizzle";
import { files, organizations } from "@kyren/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const MB = 1024 * 1024;

describe("the storage quota under concurrent uploads", () => {
  it("lets only as many files in as fit, however many arrive at once", async () => {
    const org = await world.org("Quota race");
    const o = await world.userIn(org, "owner", "Uploader");

    // Room for two 400 KB files in a 1 MB quota, not five.
    await db
      .update(organizations)
      .set({ limits: { storageMb: 1 } })
      .where(eq(organizations.id, org.id));

    const callers = await Promise.all(
      Array.from({ length: 5 }, () => world.caller(o.user, org)),
    );
    const results = await Promise.allSettled(
      callers.map((caller, index) =>
        caller.files.libraryRegister({
          name: `part-${index}.bin`,
          mimeType: "application/octet-stream",
          size: 400 * 1024,
          storageKey: `${org.id}/race-${index}-${Date.now()}`,
        }),
      ),
    );

    const stored = await db
      .select({ size: files.size })
      .from(files)
      .where(and(eq(files.organizationId, org.id), isNull(files.deletedAt)));
    const used = stored.reduce((sum, row) => sum + row.size, 0);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(used).toBeLessThanOrEqual(MB);
  });
});
