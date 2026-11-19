import { timingSafeEqual } from "node:crypto";

import { reportError, runChatJobs } from "@zentro/api/server";
import { db } from "@zentro/db";

import { storage } from "../../../../lib/storage";
import { maintenanceResponse } from "../../../../lib/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Compares in constant time so the secret can't be guessed byte by byte. */
function sameSecret(given: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(given ?? "");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Chat's background work: scheduled messages, reminders, retention and
 * overdue-task notices. Called by a scheduler (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. `?light=1` skips the expensive
 * sweeps (retention, purges, overdue notices) so a frequent pinger can deliver
 * reminders and scheduled messages on time; the daily run does everything.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || !sameSecret(request.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Background jobs write too (scheduled messages, purges, automations), so
  // they wait while the platform is read-only; the next run catches up.
  const paused = await maintenanceResponse();

  if (paused) return paused;

  try {
    const result = await runChatJobs(
      db as unknown as Parameters<typeof runChatJobs>[0],
      {
        heavy: new URL(request.url).searchParams.get("light") !== "1",
        removeFiles: async (keys) => {
          await Promise.all(keys.map((key) => storage().remove(key)));
        },
      },
    );

    return Response.json(result);
  } catch (error) {
    await reportError("cron", error);

    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
