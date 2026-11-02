import { sql } from "@zentro/db/drizzle";
import { db } from "@zentro/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Readiness probe for the host, container health checks and uptime monitors.
 * Public by design, so it answers only ok or not: never a version, a
 * hostname or the database's error text.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    console.error("[health] database check failed", error);

    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
