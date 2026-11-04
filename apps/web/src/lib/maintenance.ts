import { maintenanceState } from "@zentro/api/server";
import { db } from "@zentro/db";

/**
 * While the platform is in maintenance mode, routes that accept changes answer
 * 503 with a retry hint instead of doing the work. Senders such as mail
 * providers retry on 503, so nothing is lost. Returns null when all is well.
 */
export async function maintenanceResponse() {
  const state = await maintenanceState(db);

  if (!state.enabled) return null;

  return Response.json(
    {
      error:
        state.message ||
        "Zentro is in maintenance and read-only for now. Try again soon.",
    },
    { status: 503, headers: { "retry-after": "300" } },
  );
}
