import { afterAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { organizations } from "@kyren/db/schema";

import { forgetIpPolicy } from "../src/server/ip-policy";
import { forgetOrganizationStatus } from "../src/server/platform-policy";
import { workspaceAccessBlock } from "../src/server/workspace-access";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const from = (ip: string) => new Headers({ "x-forwarded-for": ip });

describe("the check pages and the API share", () => {
  it("blocks a suspended organization and a network off the allow-list", async () => {
    const org = await world.org("Workspace access");
    const o = await world.userIn(org, "owner", "Owner");
    const office = await world.caller(o.user, org, {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });

    expect(
      await workspaceAccessBlock(db, org.id, from("198.51.100.7")),
    ).toBeNull();

    await office.ipAccess.add({ cidr: "203.0.113.0/24", label: "Office" });
    await office.ipAccess.setEnabled({ enabled: true });
    forgetIpPolicy(org.id);

    expect(
      await workspaceAccessBlock(db, org.id, from("203.0.113.9")),
    ).toBeNull();
    expect(
      await workspaceAccessBlock(db, org.id, from("198.51.100.7")),
    ).toMatchObject({ reason: "network" });

    await db
      .update(organizations)
      .set({ suspendedAt: new Date(), suspendedReason: "Billing review" })
      .where(eq(organizations.id, org.id));
    forgetOrganizationStatus(org.id);

    expect(await workspaceAccessBlock(db, org.id, from("203.0.113.9"))).toEqual(
      {
        reason: "suspended",
        message: "This organization is suspended: Billing review",
      },
    );
  });
});
