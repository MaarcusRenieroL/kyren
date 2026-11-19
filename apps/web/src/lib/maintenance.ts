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

/**
 * Auth calls that still work during maintenance: getting in and out, the
 * second factor, picking an organization to read, and ending a session that
 * isn't yours. Everything else that changes data (sign-up, new organizations,
 * invitations, roles, passwords) waits until maintenance ends.
 */
const authDuringMaintenance = new Set([
  "sign-in/email",
  "sign-out",
  "two-factor/verify-totp",
  "two-factor/verify-backup-code",
  "organization/set-active",
  "organization/check-slug",
  "revoke-session",
  "revoke-other-sessions",
]);

/** Whether an auth POST to this path may run while in maintenance. */
export function authAllowedDuringMaintenance(pathname: string) {
  const at = pathname.indexOf("/api/auth/");

  if (at === -1) return false;

  const action = pathname.slice(at + "/api/auth/".length).replace(/\/+$/, "");

  return authDuringMaintenance.has(action);
}
