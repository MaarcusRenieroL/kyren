import { TRPCError } from "@trpc/server";
import { auth } from "@zentro/auth";
import { eq, ilike, or } from "@zentro/db/drizzle";
import {
  members,
  organizations,
  sessions,
  twoFactors,
  users,
} from "@zentro/db/schema";
import type { db as Database } from "@zentro/db";
import { z } from "zod";

import { callAuth } from "../auth-calls";
import { recordPlatformAudit } from "../platform-audit";
import { platformProcedure, router } from "../trpc";

const userInput = z.object({ userId: z.string().uuid() });

async function findUser(db: typeof Database, userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such user." });
  }

  return user;
}

export const platformUsersRouter = router({
  /** Finds people by name or email across every organization. */
  lookup: platformProcedure
    .input(z.object({ query: z.string().trim().min(2).max(100) }))
    .query(async ({ ctx, input }) => {
      const term = input.query.replace(/[%_\\]/g, "\\$&");
      const found = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          emailVerified: users.emailVerified,
          twoFactorEnabled: users.twoFactorEnabled,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(
          or(ilike(users.email, `%${term}%`), ilike(users.name, `%${term}%`)),
        )
        .orderBy(users.email)
        .limit(20);
      const result = [];

      for (const user of found) {
        const memberships = await ctx.db
          .select({
            organizationId: organizations.id,
            organizationName: organizations.name,
            role: members.role,
          })
          .from(members)
          .innerJoin(
            organizations,
            eq(organizations.id, members.organizationId),
          )
          .where(eq(members.userId, user.id));
        const live = await ctx.db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.userId, user.id));

        result.push({ ...user, memberships, sessions: live.length });
      }

      return result;
    }),

  /** Ends every session of the user, wherever they are signed in. */
  signOutEverywhere: platformProcedure
    .input(userInput)
    .mutation(async ({ ctx, input }) => {
      const user = await findUser(ctx.db, input.userId);
      const ended = await ctx.db
        .delete(sessions)
        .where(eq(sessions.userId, user.id))
        .returning({ id: sessions.id });

      await recordPlatformAudit(ctx, {
        action: "user.signed_out",
        targetType: "user",
        targetId: user.id,
        label: user.email,
        detail: { sessions: ended.length },
      });

      return { ended: ended.length };
    }),

  /**
   * For someone who lost both their authenticator and their backup codes:
   * turns two-factor off, deletes the old secret and codes, and ends every
   * session, so they sign in again with their password and set it up anew.
   */
  resetTwoFactor: platformProcedure
    .input(userInput)
    .mutation(async ({ ctx, input }) => {
      const user = await findUser(ctx.db, input.userId);

      const ended = await ctx.db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ twoFactorEnabled: false, updatedAt: new Date() })
          .where(eq(users.id, user.id));
        await tx.delete(twoFactors).where(eq(twoFactors.userId, user.id));

        return tx
          .delete(sessions)
          .where(eq(sessions.userId, user.id))
          .returning({ id: sessions.id });
      });

      await recordPlatformAudit(ctx, {
        action: "user.two_factor_reset",
        targetType: "user",
        targetId: user.id,
        label: user.email,
        detail: { sessions: ended.length },
      });

      return { reset: true };
    }),

  /** Emails the user a password reset link; the operator never sees or sets a password. */
  sendPasswordReset: platformProcedure
    .input(userInput)
    .mutation(async ({ ctx, input }) => {
      const user = await findUser(ctx.db, input.userId);

      await callAuth(() =>
        auth.api.requestPasswordReset({
          body: { email: user.email, redirectTo: "/auth/reset-password" },
        }),
      );
      await recordPlatformAudit(ctx, {
        action: "user.password_reset_sent",
        targetType: "user",
        targetId: user.id,
        label: user.email,
      });

      return { sent: true };
    }),
});
