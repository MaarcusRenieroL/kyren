import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { rateLimits } from "@zentro/db/schema";
import { like } from "@zentro/db/drizzle";

import { hit } from "../src/server/rate-limit";

const prefix = `test:${randomUUID()}`;

afterAll(async () => {
  await db.delete(rateLimits).where(like(rateLimits.key, `${prefix}%`));
});

describe("hit", () => {
  it("allows up to the limit inside a window, then refuses", async () => {
    const key = `${prefix}:a`;
    const results = [];

    for (let i = 0; i < 4; i += 1) {
      results.push(await hit(db, key, { max: 3, windowMs: 60_000 }));
    }

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]!.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each key on its own", async () => {
    const a = await hit(db, `${prefix}:b`, { max: 1, windowMs: 60_000 });
    const b = await hit(db, `${prefix}:c`, { max: 1, windowMs: 60_000 });

    expect([a.allowed, b.allowed]).toEqual([true, true]);
  });

  it("starts a new window after it has passed", async () => {
    const key = `${prefix}:d`;
    const now = Date.now();

    await hit(db, key, { max: 1, windowMs: 1000, now });

    expect((await hit(db, key, { max: 1, windowMs: 1000, now })).allowed).toBe(
      false,
    );
    expect(
      (await hit(db, key, { max: 1, windowMs: 1000, now: now + 1500 })).allowed,
    ).toBe(true);
  });

  it("is safe under concurrent calls", async () => {
    const key = `${prefix}:e`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        hit(db, key, { max: 4, windowMs: 60_000 }),
      ),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(4);
  });
});
