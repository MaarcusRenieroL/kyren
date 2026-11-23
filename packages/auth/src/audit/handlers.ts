import { randomUUID } from "node:crypto";
import { requestContextFromHeaders } from "@kyren/audit/server";
import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { users } from "@kyren/db/schema";
import { sendNewSignInEmail } from "../lib/email";
import { isNewDevice } from "../lib/new-device";
import { recordForUser, recordInOrganization, userByEmail } from "./recorder";
import { failed, resetTokenUsers, type HookContext } from "./types";

export async function handleAuthAfter(
  ctx: HookContext,
  sessionUserId: () => Promise<string | null>,
) {
  const { returned } = ctx.context;
  const body = (ctx.body ?? {}) as Record<string, unknown>;

  switch (ctx.path) {
    case "/sign-in/email": {
      if (failed(returned)) {
        const user = await userByEmail(body.email);
        if (user) {
          await recordForUser(ctx, user.id, "auth.sign_in_failed");
        }
        return;
      }

      const userId = ctx.context.newSession?.user.id;
      if (userId) {
        const request = requestContextFromHeaders(ctx.headers, randomUUID());
        const unfamiliar = await isNewDevice(userId, request.userAgent ?? null);

        await recordForUser(ctx, userId, "auth.sign_in");

        if (unfamiliar) {
          const user = await userByEmail(body.email);
          void sendNewSignInEmail(user?.email ?? String(body.email), {
            browser: request.userAgent ?? "unknown",
            ip: request.ip ?? null,
            when: new Date(),
          }).catch((error) =>
            console.error("[auth] could not send the sign-in alert", error),
          );
        }
      }
      return;
    }

    case "/sign-up/email": {
      const userId = ctx.context.newSession?.user.id;
      if (!failed(returned) && userId) {
        await recordForUser(ctx, userId, "auth.sign_up");
      }
      return;
    }

    case "/email-otp/verify-email": {
      if (failed(returned)) return;
      const user = await userByEmail(body.email);
      if (user) {
        await recordForUser(ctx, user.id, "auth.email_verified");
      }
      return;
    }

    case "/request-password-reset": {
      if (failed(returned)) return;
      const user = await userByEmail(body.email);
      if (user) {
        await recordForUser(ctx, user.id, "auth.password_reset_requested");
      }
      return;
    }

    case "/reset-password": {
      const userId = ctx.request ? resetTokenUsers.get(ctx.request) : null;
      if (!failed(returned) && userId) {
        await recordForUser(ctx, userId, "auth.password_reset_completed");
      }
      return;
    }

    case "/change-password": {
      if (failed(returned)) return;
      const userId = await sessionUserId();
      if (userId) {
        await recordForUser(ctx, userId, "auth.password_changed");
      }
      return;
    }

    case "/organization/create": {
      const created = returned as { id?: string; name?: string } | Error;
      const userId = await sessionUserId();
      if (!failed(created) && "id" in created && created.id) {
        await recordInOrganization(ctx, {
          organizationId: created.id,
          actorUserId: userId,
          action: "org.created",
          targetId: created.id,
          label: created.name,
        });
      }
      return;
    }

    case "/organization/accept-invitation":
    case "/organization/reject-invitation": {
      if (failed(returned)) return;
      const result = returned as {
        invitation?: { id: string; email: string; organizationId: string };
        member?: { id: string; userId: string; organizationId: string };
      } | null;
      const userId = await sessionUserId();
      const invitation = result?.invitation;
      if (!invitation) return;

      const accepted = ctx.path === "/organization/accept-invitation";
      await recordInOrganization(ctx, {
        organizationId: invitation.organizationId,
        actorUserId: userId,
        action: accepted ? "invitation.accepted" : "invitation.rejected",
        targetId: invitation.id,
        label: invitation.email,
      });

      if (accepted && result?.member) {
        const [person] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, result.member.userId))
          .limit(1);

        await recordInOrganization(ctx, {
          organizationId: invitation.organizationId,
          actorUserId: userId,
          action: "member.joined",
          targetId: result.member.id,
          label: person ? person.name || person.email : null,
        });
      }
      return;
    }

    case "/organization/leave": {
      const left = returned as
        | { id?: string; organizationId?: string; userId?: string }
        | Error
        | undefined;

      if (
        left &&
        !failed(left) &&
        "organizationId" in left &&
        left.organizationId &&
        left.userId
      ) {
        const [person] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, left.userId))
          .limit(1);

        await recordInOrganization(ctx, {
          organizationId: left.organizationId,
          actorUserId: left.userId,
          action: "member.left",
          targetId: left.id ?? left.userId,
          label: person ? person.name || person.email : null,
        });
      }
      return;
    }

    default:
      return;
  }
}
