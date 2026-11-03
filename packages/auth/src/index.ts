import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { auditAfter, auditBefore } from "./audit-hooks";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP, organization, twoFactor } from "better-auth/plugins";

import { db } from "@zentro/db";
import { hit } from "@zentro/db/rate-limit";
import { desc, eq } from "@zentro/db/drizzle";
import * as schema from "@zentro/db/schema";
import {
  sendForgotPasswordEmail,
  sendVerificationEmail,
  sendOrgInviteEmail,
} from "./lib/email";
import { validateProductionEnv } from "./lib/env";
import { trustedOriginsFor } from "./lib/origins";
import { twoFactorChallenge } from "./lib/two-factor-challenge";
import { betterAuthAc, betterAuthRoles } from "./access-control";
import { ensureSystemRoles, removeMemberAccess } from "./seed";
import { userAdditionalFields } from "./additional-fields";

validateProductionEnv();

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const secret = process.env.BETTER_AUTH_SECRET;

const trustedOrigins = trustedOriginsFor(baseURL, process.env.NODE_ENV);

// Endpoints that read or change organization data are only reachable through
// our tRPC procedures, which check permissions with @zentro/permissions. Better
// Auth's own role check is wide open (see access-control.ts), so leaving these
// reachable over HTTP would let any member call them directly.
const disabledOrganizationPaths = [
  "/organization/add-team-member",
  "/organization/cancel-invitation",
  "/organization/create-role",
  "/organization/create-team",
  "/organization/delete",
  "/organization/delete-role",
  "/organization/get-active-member",
  "/organization/get-active-member-role",
  "/organization/get-full-organization",
  "/organization/get-invitation",
  "/organization/get-organization",
  "/organization/get-role",
  "/organization/has-permission",
  "/organization/invite-member",
  "/organization/list-invitations",
  "/organization/list-members",
  "/organization/list-roles",
  "/organization/list-team-members",
  "/organization/list-teams",
  "/organization/list-user-invitations",
  "/organization/list-user-teams",
  "/organization/remove-member",
  "/organization/remove-team",
  "/organization/remove-team-member",
  "/organization/set-active-team",
  "/organization/update",
  "/organization/update-member-role",
  "/organization/update-role",
  "/organization/update-team",
  // Accepts any session field, including `activeOrganizationId`, so a session
  // could be pointed at an organization the user does not belong to.
  "/update-session",
];

export const auth = betterAuth({
  disabledPaths: disabledOrganizationPaths,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Each password sign-in gets a few guesses at its code. Counting per
      // challenge (not per IP) stops a distributed guess at a 6-digit code.
      if (ctx.path.startsWith("/two-factor/verify")) {
        const challenge = twoFactorChallenge(ctx.headers?.get("cookie"));

        if (challenge) {
          const result = await hit(db, `2fa:${challenge}`, {
            max: 5,
            windowMs: 10 * 60 * 1000,
          });

          if (!result.allowed) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Too many attempts. Sign in again to get a new code.",
            });
          }
        }
      }

      await auditBefore(ctx, async () => {
        const session = await getSessionFromCtx(ctx).catch(() => null);

        return session?.user.id ?? null;
      });
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Leaving an organization deletes the member row directly and skips the
      // organization hooks, so the access that came with it is cleared here.
      if (ctx.path === "/organization/leave") {
        const left = ctx.context.returned as
          | { organizationId?: string; userId?: string }
          | undefined;

        if (left?.organizationId && left.userId) {
          await removeMemberAccess(db, left.organizationId, left.userId);
        }
      }

      await auditAfter(ctx, async () => {
        const session = await getSessionFromCtx(ctx).catch(() => null);

        return session?.user.id ?? ctx.context.newSession?.user.id ?? null;
      });
    }),
  },
  baseURL,
  secret,
  trustedOrigins,
  user: {
    additionalFields: userAdditionalFields,
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited on purpose, so response time does not reveal whether the
      // address has an account; failures are logged instead of left unhandled.
      void sendForgotPasswordEmail(user.email, url).catch((error: unknown) => {
        console.error("Could not send the password reset email", error);
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60,
  },
  databaseHooks: {
    session: {
      create: {
        // Open every new session in the user's most recently joined
        // organization. Users without one are sent to onboarding instead.
        before: async (session) => {
          const [latestMembership] = await db
            .select({ organizationId: schema.members.organizationId })
            .from(schema.members)
            .where(eq(schema.members.userId, session.userId))
            .orderBy(desc(schema.members.createdAt))
            .limit(1);

          if (!latestMembership) {
            return { data: session };
          }

          return {
            data: {
              ...session,
              activeOrganizationId: latestMembership.organizationId,
            },
          };
        },
      },
    },
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      verification: schema.verifications,
      organization: schema.organizations,
      member: schema.members,
      invitation: schema.invitations,
      rateLimit: schema.rateLimits,
      twoFactor: schema.twoFactors,
    },
  }),

  // Counted in Postgres so serverless instances share one limit. Off outside
  // production so tests and local work are not throttled.
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 20 },
      "/two-factor/verify-backup-code": { window: 60, max: 20 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/email-otp/verify-email": { window: 60, max: 5 },
    },
  },

  advanced: {
    // Rate limits key on the client address, so read it from the header the
    // platform sets itself; `x-forwarded-for` is the fallback behind a proxy.
    ipAddress: {
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],
    },
    database: {
      generateId: false,
    },
  },

  plugins: [
    // Opt-in authenticator-app codes. Backup codes cover a lost phone.
    twoFactor({ issuer: "Zentro" }),
    organization({
      ac: betterAuthAc,
      roles: betterAuthRoles,
      requireEmailVerificationOnInvitation: true,
      sendInvitationEmail: async ({ invitation, organization, inviter }) => {
        await sendOrgInviteEmail(invitation, organization, inviter);
      },
      invitationExpiresIn: 60 * 60 * 24 * 7,
      organizationHooks: {
        // Every organization starts with its system roles in place.
        afterCreateOrganization: async ({ organization }) => {
          await ensureSystemRoles(db, organization.id);
        },
        // Whatever access a member had in the organization goes with them.
        afterRemoveMember: async ({ member, organization }) => {
          await removeMemberAccess(db, organization.id, member.userId);
        },
      },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "email-verification") {
          await sendVerificationEmail(email, otp);
        }
      },
    }),
  ],
});

export { ensureSystemRoles, removeMemberAccess } from "./seed";
export { disabledOrganizationPaths };
