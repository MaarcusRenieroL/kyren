import { sql } from "drizzle-orm";

import type { db as database } from "./client";

type Database = Pick<typeof database, "execute">;

type Options = {
  max: number;
  windowMs: number;
  /** For tests: the current time in milliseconds. */
  now?: number;
};

/**
 * Counts one call against `key` in a fixed window and says whether it may go
 * ahead. One atomic statement, so concurrent calls can't slip past the limit.
 * The window starts at the first call and the count resets once it has passed.
 */
export async function hit(db: Database, key: string, options: Options) {
  const now = options.now ?? Date.now();
  const result = await db.execute(sql`
    insert into "rateLimit" ("key", "count", "lastRequest")
    values (${key}, 1, ${now})
    on conflict ("key") do update set
      "count" = case
        when "rateLimit"."lastRequest" <= ${now - options.windowMs} then 1
        else "rateLimit"."count" + 1
      end,
      "lastRequest" = case
        when "rateLimit"."lastRequest" <= ${now - options.windowMs} then ${now}
        else "rateLimit"."lastRequest"
      end
    returning "count", "lastRequest"
  `);
  const row = (
    result as unknown as {
      rows: Array<{ count: number; lastRequest: string | number }>;
    }
  ).rows[0]!;
  const windowEnds = Number(row.lastRequest) + options.windowMs;

  return {
    allowed: row.count <= options.max,
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnds - now) / 1000)),
  };
}
