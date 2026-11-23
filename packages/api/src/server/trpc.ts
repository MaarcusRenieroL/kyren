import { assertProtectedContext, assertPlatformContext, PLATFORM_ADMIN_ROLE } from "./trpc-procedure-guards";
export { PLATFORM_ADMIN_ROLE };
import { initTRPC, TRPCError } from "@trpc/server";
import type { Decision, ResourceContext } from "@kyren/permissions";
import superjson from "superjson";
import { ZodError } from "zod";

import type { ModuleId } from "@kyren/modules";

import type { TRPCContext } from "../types";

import type { ProcedureMeta } from "./trpc-types";
export type { ProcedureMeta };

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
import { maintenanceState } from "./platform-policy";

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

/**
 * While the platform is in maintenance mode it answers reads but refuses
 * changes, except the platform console's own, so operators can end it.
 */
const maintenanceGuard = trpc.middleware(async ({ ctx, type, path, next }) => {
  if (type === "mutation" && !path.startsWith("platform.")) {
    const state = await maintenanceState(ctx.db);

    if (state.enabled) {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message:
          state.message ||
          "Kyren is in maintenance and read-only for now. Try again soon.",
      });
    }
  }

  return next();
});

const baseProcedure = trpc.procedure
  .use(burstLimit)
  .use(maintenanceGuard)
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
  const verified = await assertProtectedContext(ctx);
  return next({
    ctx: {
      ...ctx,
      user: verified.user,
      activeOrganization: verified.activeOrganization,
    },
  });
});

export const organizationProcedure = protectedProcedure;

export const platformProcedure = baseProcedure
  .meta({ platform: true })
  .use(async ({ ctx, next, type, path }) => {
    const user = await assertPlatformContext(ctx);
    const platformAudit = { recorded: 0 };
    const result = await next({ ctx: { ...ctx, user, platformAudit } });

    if (result.ok && type === "mutation" && platformAudit.recorded === 0) {
      const message = `${path} succeeded without writing to the platform audit trail`;

      if (process.env.NODE_ENV === "production") {
        console.error(`[platform-audit] ${message}`);
      } else {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }

    return result;
  });

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

import {
  denialFor,
  assertAnyPermission,
  assertRecentSignIn,
  ARCHIVED_PROJECT_ACTIONS,
} from "./trpc-permission-helpers";

export { denialFor, assertAnyPermission, assertRecentSignIn };

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

      // An archived project is read-only: nothing in it changes until it is
      // restored. Restoring, deleting and its access settings still work.
      if (
        opts.type === "mutation" &&
        resource?.project?.status === "archived" &&
        !ARCHIVED_PROJECT_ACTIONS.has(permission)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This project is archived. Restore it to make changes.",
        });
      }

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
