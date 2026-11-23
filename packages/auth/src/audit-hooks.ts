import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { verifications } from "@zentro/db/schema";
import { handleAuthAfter } from "./audit/handlers";
import { recordForUser, recordInOrganization } from "./audit/recorder";
import { resetTokenUsers, type HookContext } from "./audit/types";

export { recordForUser, recordInOrganization } from "./audit/recorder";
export type { HookContext } from "./audit/types";

/** Before hook: facts that are gone once the request has been handled. */
export async function auditBefore(
  ctx: HookContext,
  sessionUserId: () => Promise<string | null>,
) {
  if (ctx.path === "/sign-out") {
    const userId = await sessionUserId();
    if (userId) {
      await recordForUser(ctx, userId, "auth.sign_out");
    }
  }

  if (ctx.path === "/reset-password" && ctx.request) {
    const token =
      (ctx.body as { token?: string } | undefined)?.token ??
      new URL(ctx.request.url).searchParams.get("token");

    if (token) {
      // The token is only used to find the person; it is never stored.
      const [row] = await db
        .select({ value: verifications.value })
        .from(verifications)
        .where(and(eq(verifications.identifier, `reset-password:${token}`)))
        .limit(1);

      if (row) {
        resetTokenUsers.set(ctx.request, row.value);
      }
    }
  }
}

/** After hook: records what the finished request did. */
export async function auditAfter(
  ctx: HookContext,
  sessionUserId: () => Promise<string | null>,
) {
  return handleAuthAfter(ctx, sessionUserId);
}
