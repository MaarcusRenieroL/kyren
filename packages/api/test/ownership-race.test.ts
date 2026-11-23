import { afterAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { members } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("ownership transfer", () => {
  it("leaves exactly one owner when it is submitted twice at once", async () => {
    const org = await world.org("Ownership race");
    const o = await world.userIn(org, "owner", "Founder");
    const a = await world.userIn(org, "admin", "Heir A");
    const b = await world.userIn(org, "admin", "Heir B");
    const founder = await world.caller(o.user, org);

    const results = await Promise.allSettled([
      founder.member.transferOwnership({ memberId: a.member.id }),
      founder.member.transferOwnership({ memberId: b.member.id }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const rows = await db
      .select({ role: members.role })
      .from(members)
      .where(eq(members.organizationId, org.id));

    expect(rows.filter((row) => row.role === "owner")).toHaveLength(1);
  });
});
