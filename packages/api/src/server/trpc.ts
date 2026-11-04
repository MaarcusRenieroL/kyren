import { initTRPC, TRPCError } from "@trpc/server";
import type { Decision, ResourceContext } from "@zentro/permissions";
import superjson from "superjson";
import { ZodError } from "zod";

import type { ModuleId } from "@zentro/modules";

import type { TRPCContext } from "../types";

export type ProcedureMeta = {
  /**
   * Permission keys the procedure enforces (any of them is enough). The
   * coverage test requires every procedure to declare keys here or to be on
   * the explicit allowlist.
   */
  permissions?: string[];
  /**
   * Activity event keys a mutation writes (any of them is enough). After the
   * mutation succeeds, the audit guard checks that one was recorded through
   * `ctx.audit`. The sweep test requires every mutation to declare keys.
   */
  audit?: string[];
};

const trpc = initTRPC
  .context<TRPCContext>()
  .meta<ProcedureMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

import { enforceBurstLimit } from "./burst-limit";
import { isUniqueViolation } from "./db-errors";
import { clientIp } from "./client-ip";
import { ipAllowed } from "./ip-policy";
import { requiresTwoFactor } from "./two-factor-policy";

export const router = trpc.router;

/**
 * Every mutation that declares `meta.audit` must record one of those events.
 * In tests and development a miss throws; in production it is logged and the
 * request still succeeds, because the change has already been committed.
 */
const auditGuard = trpc.middleware(async ({ ctx, type, meta, path, next }) => {
  if (type !== "mutation" || !meta?.audit?.length) {
    return next();
  }

  // Calls in one request each track their own events.
  const audit = ctx.audit.forCall();
  const result = await next({ ctx: { ...ctx, audit } });

  if (result.ok && !meta.audit.some((key) => audit.recorded.includes(key))) {
    const message = `${path} succeeded without recording any of: ${meta.audit.join(", ")}`;

    if (process.env.NODE_ENV === "production") {
      console.error(`[audit] ${message}`);
    } else {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
    }
  }

  return result;
});

const burstLimit = trpc.middleware(({ ctx, type, next }) => {
  if (ctx.user?.id) {
    enforceBurstLimit(ctx.user.id, type);
  }

  return next();
});

/**
 * A create that loses a race on a unique name or slug fails inside Postgres.
 * Say so plainly instead of returning a server error.
 */
const conflictMapper = trpc.middleware(async ({ next }) => {
  const result = await next();

  if (
    !result.ok &&
    result.error.code === "INTERNAL_SERVER_ERROR" &&
    isUniqueViolation(result.error.cause)
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That already exists. Try a different name.",
    });
  }

  return result;
});

const baseProcedure = trpc.procedure
  .use(burstLimit)
  .use(conflictMapper)
  .use(auditGuard);

export const publicProcedure = baseProcedure;

/** Requires a session but, unlike protectedProcedure, no active organization. */
export const authenticatedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }

  // The page proxy already sends unverified users to verification; this keeps
  // the API from being used directly with an address nobody has confirmed.
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

  // An organization can insist on two-factor. The page for turning it on is
  // outside the workspace and uses no workspace procedures.
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

  // An organization can limit itself to chosen networks.
  if (
    !(await ipAllowed(ctx.db, ctx.activeOrganization.id, clientIp(ctx.headers)))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your network is not allowed to use this organization.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      activeOrganization: ctx.activeOrganization,
    },
  });
});

export const organizationProcedure = protectedProcedure;

/** The role that grants access to the platform console. Only set by an operator on the database. */
export const PLATFORM_ADMIN_ROLE = "platform_admin";

/**
 * For the platform console, which runs above every organization. The caller
 * must be a platform admin with a verified email, two-factor turned on and a
 * recent sign-in. Anyone else gets "not found", so the console cannot be probed.
 */
export const platformProcedure = baseProcedure.use(({ ctx, next }) => {
  const user = ctx.user;

  if (
    !user?.id ||
    user.role !== PLATFORM_ADMIN_ROLE ||
    user.emailVerified === false
  ) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Not found." });
  }

  if (!user.twoFactorEnabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Platform access needs two-factor sign-in. Turn it on first.",
    });
  }

  assertRecentSignIn(ctx.session?.session.createdAt);

  return next({ ctx: { ...ctx, user } });
});

/**
 * Rejects the call when the module is turned off for the caller's active
 * organization. The enabled set is loaded once per request by the context.
 */
export const moduleProcedure = (moduleId: ModuleId) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    const enabledModules = await ctx.enabledModules();

    if (!enabledModules.has(moduleId)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Module disabled",
      });
    }

    return next({ ctx });
  });

type OrganizationContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  activeOrganization: NonNullable<TRPCContext["activeOrganization"]>;
};

/**
 * Tells the permission engine which team, project or owner a call targets.
 * `input` is the raw, not yet validated input of the procedure.
 */
export type ScopeResolver = (args: {
  ctx: OrganizationContext;
  input: unknown;
}) => Promise<ResourceContext | undefined> | ResourceContext | undefined;

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
function assertRecentSignIn(startedAt: Date | string | undefined) {
  const started = startedAt ? new Date(startedAt).getTime() : 0;

  if (Date.now() - started > FRESH_SIGN_IN_MS) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "For your security, sign in again to do this. Sign out, sign back in, then retry.",
    });
  }
}

/**
 * The one way to protect a procedure: the module (when given) must be on, then
 * the caller must hold the permission for the resource the resolver names.
 */
export const permissionProcedure = (
  permission: string,
  resolve?: ScopeResolver,
  options: {
    module?: ModuleId;
    /** Further keys the handler checks itself (declared for the coverage test). */
    also?: string[];
    /** Activity events a mutation records (see `ProcedureMeta.audit`). */
    audit?: string[];
    /** Refuses a session that began long ago; for actions that are hard to undo. */
    fresh?: boolean;
  } = {},
) => {
  const base = options.module
    ? moduleProcedure(options.module)
    : protectedProcedure;

  return base
    .meta({
      permissions: [permission, ...(options.also ?? [])],
      ...(options.audit ? { audit: options.audit } : {}),
    })
    .use(async (opts) => {
      const { ctx, next, getRawInput } = opts;

      if (options.fresh) assertRecentSignIn(ctx.session?.session.createdAt);

      const resource = resolve
        ? await resolve({
            ctx: ctx as OrganizationContext,
            input: await getRawInput(),
          })
        : undefined;

      await assertAnyPermission(
        ctx as OrganizationContext,
        [permission],
        resource,
      );

      return next({ ctx });
    });
};

/**
 * For list procedures: no single resource to check, so the caller only needs
 * to be a member. The procedure filters its results with
 * `ctx.permissions.viewableProjectIds`.
 */
export const listProcedure = (permission: string, moduleId?: ModuleId) => {
  const base = moduleId ? moduleProcedure(moduleId) : protectedProcedure;

  return base.meta({ permissions: [permission] }).use(async ({ ctx, next }) => {
    const snapshot = await ctx.permissions.snapshot();

    if (!snapshot.baseRole && !snapshot.assignments.length) {
      throw denialFor({ allowed: false, reasons: [] });
    }

    return next({ ctx });
  });
};

export type { OrganizationContext };
