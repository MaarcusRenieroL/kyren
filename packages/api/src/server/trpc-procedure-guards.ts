import { TRPCError } from "@trpc/server";
import type { TRPCContext } from "../types";
import { requiresTwoFactor } from "./two-factor-policy";
import { workspaceAccessBlock } from "./workspace-access";
import { clientIp } from "./client-ip";
import { platformIpAllowed } from "./platform-policy";
import { assertRecentSignIn } from "./trpc-permission-helpers";

export const PLATFORM_ADMIN_ROLE = "platform_admin";

export async function assertProtectedContext(ctx: TRPCContext) {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }

  if (ctx.user.emailVerified === false) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Verify your email address first.",
    });
  }

  if (!ctx.activeOrganization) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active organization selected",
    });
  }

  if (
    !ctx.user.twoFactorEnabled &&
    (await requiresTwoFactor(ctx.db, ctx.activeOrganization.id))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Your organization requires two-factor sign-in. Turn it on in Settings, Security.",
    });
  }

  const block = await workspaceAccessBlock(
    ctx.db,
    ctx.activeOrganization.id,
    ctx.headers,
  );

  if (block) {
    throw new TRPCError({ code: "FORBIDDEN", message: block.message });
  }

  return {
    user: ctx.user,
    activeOrganization: ctx.activeOrganization,
  };
}

export async function assertPlatformContext(ctx: TRPCContext) {
  const user = ctx.user;

  if (!user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }

  if (user.role !== PLATFORM_ADMIN_ROLE || user.emailVerified === false) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Not found." });
  }

  if (!user.twoFactorEnabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Platform access needs two-factor sign-in. Turn it on first.",
    });
  }

  if (!(await platformIpAllowed(ctx.db, clientIp(ctx.headers)))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Not found." });
  }

  assertRecentSignIn(ctx.session?.session.createdAt);

  return user;
}
