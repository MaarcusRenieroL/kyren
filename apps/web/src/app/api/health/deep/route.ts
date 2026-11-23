import { timingSafeEqual } from "node:crypto";

import { db } from "@kyren/db";
import { sql } from "@kyren/db/drizzle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A job still waiting this long after it was due is stuck. */
const STUCK_MINUTES = 15;

function sameSecret(given: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(given ?? "");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * What the monitor watches: the database, background jobs that are stuck
 * and jobs that gave up. Private (the cron secret), unlike /api/health.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || !sameSecret(request.headers.get("authorization"), secret)) {
    return new Response(null, { status: 404 });
  }

  try {
    const rows = (await db.execute(sql`
      select
        count(*) filter (
          where status = 'pending'
            and "runAt" < now() - make_interval(mins => ${STUCK_MINUTES})
        )::int as stuck,
        count(*) filter (where status = 'dead')::int as dead
      from job
    `)) as unknown as { rows: Array<{ stuck: number; dead: number }> };
    const counts = rows.rows[0] ?? { stuck: 0, dead: 0 };

    return Response.json(
      {
        status: counts.stuck > 0 ? "degraded" : "ok",
        database: "ok",
        jobs: { stuck: counts.stuck, dead: counts.dead },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] deep check failed", error);

    return Response.json(
      { status: "unavailable", database: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
