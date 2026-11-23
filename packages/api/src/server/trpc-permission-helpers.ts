import { TRPCError } from "@trpc/server";
import type { Decision, ResourceContext } from "@kyren/permissions";
import type { OrganizationContext } from "./trpc";

/** Hidden things look like missing things, so ids cannot be probed. */
export function denialFor(decision: Decision) {
  if (decision.reasons.some((reason) => reason.kind === "visibility")) {
    return new TRPCError({ code: "NOT_FOUND", message: "Not found." });
  }

  return new TRPCError({
    code: "FORBIDDEN",
    message: "You do not have permission to perform this action",
  });
}

/** Throws unless the caller holds at least one of the permissions. */
export async function assertAnyPermission(
  ctx: OrganizationContext,
  permissions: string[],
  resource: ResourceContext = {},
) {
  let last: Decision | undefined;

  for (const permission of permissions) {
    const decision = await ctx.permissions.check(permission, resource);

    if (decision.allowed) {
      return;
    }

    last = decision;
  }

  throw denialFor(last ?? { allowed: false, reasons: [] });
}

/** How recently someone must have signed in to do something hard to undo. */
const FRESH_SIGN_IN_MS = 30 * 60 * 1000;

/**
 * A stolen or forgotten session should not be able to mint API keys, open
 * webhooks or hand over the organization. Signing in again fixes it.
 */
export function assertRecentSignIn(startedAt: Date | string | undefined) {
  const started = startedAt ? new Date(startedAt).getTime() : 0;

  if (Date.now() - started > FRESH_SIGN_IN_MS) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "For your security, sign in again to do this. Sign out, sign back in, then retry.",
    });
  }
}

/** What still works on an archived project: bringing it back or ending it. */
export const ARCHIVED_PROJECT_ACTIONS = new Set([
  "projects.archive",
  "projects.delete",
  "projects.settings.manage",
]);

