import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { apiKeys } from "@zentro/db/schema";

import { authenticateApiKey, bearerToken } from "../src/server/api-keys";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("API keys", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let member: Awaited<ReturnType<World["caller"]>>;
  let other: Awaited<ReturnType<World["caller"]>>;
  let orgId: string;

  beforeAll(async () => {
    const org = await world.org("Keys org");
    const o = await world.userIn(org, "owner", "Key Owner");
    const m = await world.userIn(org, "member", "Key Member");
    const otherOrg = await world.org("Other keys org");
    const x = await world.userIn(otherOrg, "owner", "Other Owner");

    orgId = org.id;
    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    other = await world.caller(x.user, otherOrg);
  });

  it("shows the key once and stores only its hash", async () => {
    const created = await owner.apiKey.create({ name: "Zapier" });

    expect(created.key).toMatch(/^zk_live_/);

    const [row] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, created.id));

    expect(row?.keyHash).not.toBe(created.key);
    expect(JSON.stringify(row)).not.toContain(created.key);

    const listed = await owner.apiKey.list();
    expect(listed.find((key) => key.id === created.id)?.prefix).toBe(
      created.key.slice(0, 12),
    );
    expect(JSON.stringify(listed)).not.toContain(created.key);
  });

  it("authenticates a live key as its creator and refuses a revoked one", async () => {
    const created = await owner.apiKey.create({ name: "Temp" });
    const found = await authenticateApiKey(db, created.key);

    expect(found?.organizationId).toBe(orgId);
    expect(found?.user.name).toBe("Key Owner");

    await owner.apiKey.revoke({ id: created.id });

    expect(await authenticateApiKey(db, created.key)).toBeNull();
  });

  it("refuses unknown, malformed and expired keys", async () => {
    const created = await owner.apiKey.create({
      name: "Short",
      expiresInDays: 1,
    });

    await db
      .update(apiKeys)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apiKeys.id, created.id));

    expect(await authenticateApiKey(db, created.key)).toBeNull();
    expect(await authenticateApiKey(db, "zk_live_nope")).toBeNull();
    expect(await authenticateApiKey(db, "x".repeat(500))).toBeNull();
    expect(bearerToken(new Headers({ authorization: "Bearer abc" }))).toBe(
      "abc",
    );
    expect(bearerToken(new Headers({ authorization: "Basic abc" }))).toBeNull();
  });

  it("is limited to people with the permission and to their own organization", async () => {
    await expect(member.apiKey.create({ name: "Nope" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(member.apiKey.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const mine = await owner.apiKey.create({ name: "Mine" });

    await expect(other.apiKey.revoke({ id: mine.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await other.apiKey.list()).map((key) => key.id)).not.toContain(
      mine.id,
    );
  });

  it("stops working when its creator leaves the organization", async () => {
    const org = await world.org("Leaver org");
    const a = await world.userIn(org, "owner", "Founder");
    const b = await world.userIn(org, "admin", "Leaver");
    const leaver = await world.caller(b.user, org);
    const created = await leaver.apiKey.create({ name: "Leaver key" });

    expect(await authenticateApiKey(db, created.key)).not.toBeNull();

    const { members } = await import("@zentro/db/schema");
    await db.delete(members).where(eq(members.id, b.member.id));

    expect(await authenticateApiKey(db, created.key)).toBeNull();
    expect(a.user.id).toBeTruthy();
  });
});
