import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@zentro/db";
import { hit } from "@zentro/db/rate-limit";
import { desc, eq } from "@zentro/db/drizzle";
import * as schema from "@zentro/db/schema";
import { clientIpHeaders } from "@zentro/audit/server";
import { userAdditionalFields } from "./additional-fields";
import { auditAfter, auditBefore } from "./audit-hooks";
import { emailOTP, organization, twoFactor } from "better-auth/plugins";
import { betterAuthAc, betterAuthRoles } from "./access-control";
import { sendOrgInviteEmail, sendVerificationEmail } from "./lib/email";
import { assertSeatAvailable, ownsTooManyOrganizations } from "./organization-limits";
import { ensureSystemRoles } from "./seed";
import { disabledCodePaths, disabledOrganizationPaths } from "./disabled-paths";
import { sendForgotPasswordEmail } from "./lib/email";
import { validateProductionEnv } from "./lib/env";
import { trustedOriginsFor } from "./lib/origins";
import { isBreachedPassword, passwordFieldFor } from "./lib/breached-password";
import { twoFactorChallenge } from "./lib/two-factor-challenge";
import { removeMemberAccess } from "./seed";

validateProductionEnv();

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const secret = process.env.BETTER_AUTH_SECRET;

const trustedOrigins = trustedOriginsFor(baseURL, process.env.NODE_ENV);

export const auth = betterAuth({
  disabledPaths: [...disabledOrganizationPaths, ...disabledCodePaths],
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

      // Refuse passwords that appear in public breach lists. Production only,
      // so test fixtures with simple passwords keep working.
      const field = passwordFieldFor(ctx.path);

      if (
        field &&
        process.env.NODE_ENV === "production" &&
        process.env.PASSWORD_BREACH_CHECK !== "off"
      ) {
        const candidate = (ctx.body as Record<string, unknown> | undefined)?.[
          field
        ];

        if (
          typeof candidate === "string" &&
          (await isBreachedPassword(candidate))
        ) {
          throw new APIError("BAD_REQUEST", {
            message:
              "That password has appeared in a data breach. Choose a different one.",
          });
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
    // Whoever had the old password, or a session made before the reset, is
    // signed out: a reset is how someone takes their account back.
    revokeSessionsOnPasswordReset: true,
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
      // Room for an office joining from one network, not for bulk sign-ups.
      "/sign-up/email": { window: 3600, max: 20 },
      "/request-password-reset": { window: 60, max: 3 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/email-otp/verify-email": { window: 60, max: 5 },
    },
  },

  advanced: {
    // Rate limits key on the client address, so read it only from headers
    // the proxy in front of Zentro sets itself (CLIENT_IP_HEADERS).
    ipAddress: {
      ipAddressHeaders: clientIpHeaders(),
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
      // Better Auth caps every organization at 100 members by default, and
      // uses the same number as the page size of member lists. Zentro's own
      // seat limit (`assertSeatAvailable`) is the real cap.
      membershipLimit: Number.MAX_SAFE_INTEGER,
      organizationLimit: (user) => ownsTooManyOrganizations(user.id),
      organizationHooks: {
        // A platform operator can cap an organization's seats; the cap is
        // checked when someone is added and again when an invitation is
        // accepted (Better Auth runs a separate hook for each).
        beforeAddMember: async ({ organization }) => {
          await assertSeatAvailable(organization.id);
        },
        beforeAcceptInvitation: async ({ organization }) => {
          await assertSeatAvailable(organization.id);
        },
        // Every organization starts with its system roles in place.
        afterCreateOrganization: async ({ organization }) => {
          await ensureSystemRoles(db, organization.id);
          // Payroll handles salaries and bank details: a new organization
          // turns it on deliberately (Settings → Modules), it isn't on by
          // default. Organizations created before keep their setting.
          await db
            .insert(schema.organizationModules)
            .values({
              organizationId: organization.id,
              moduleId: "payroll",
              enabled: false,
            })
            .onConflictDoNothing();
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
export { isNewDevice } from "./lib/new-device";
export {
  sendChatMentionEmail,
  sendMeetingEmail,
  sendTicketReplyEmail,
} from "./lib/email";
