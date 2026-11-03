import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "@zentro/db/drizzle";
import { apiKeys, users } from "@zentro/db/schema";
import { z } from "zod";

import { generateApiKey } from "../api-keys";
import { permissionProcedure, router } from "../trpc";

const procedure = (permission: string, audit?: string[]) =>
  permissionProcedure(permission, undefined, { module: "admin", audit });

export const apiKeyRouter = router({
  list: procedure("admin.manage_api_keys").query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdBy: users.name,
      })
      .from(apiKeys)
      .innerJoin(users, eq(users.id, apiKeys.createdByUserId))
      .where(
        and(
          eq(apiKeys.organizationId, ctx.activeOrganization.id),
          isNull(apiKeys.revokedAt),
        ),
      )
      .orderBy(desc(apiKeys.createdAt));
  }),

  /** Returns the key once. It cannot be read again. */
  create: procedure("admin.manage_api_keys", ["apikey.created"])
    .input(
      z.object({
        name: z.string().trim().min(1).max(80),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const generated = generateApiKey();
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 864e5)
        : null;

      const id = await ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(apiKeys)
          .values({
            organizationId: ctx.activeOrganization.id,
            createdByUserId: ctx.user.id,
            name: input.name,
            prefix: generated.prefix,
            keyHash: generated.hash,
            expiresAt,
          })
          .returning({ id: apiKeys.id });

        await ctx.audit.record(tx, {
          action: "apikey.created",
          target: { id: created!.id, label: input.name },
        });

        return created!.id;
      });

      return { id, key: generated.key };
    }),

  revoke: procedure("admin.manage_api_keys", ["apikey.revoked"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [revoked] = await tx
          .update(apiKeys)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(apiKeys.id, input.id),
              eq(apiKeys.organizationId, ctx.activeOrganization.id),
              isNull(apiKeys.revokedAt),
            ),
          )
          .returning({ id: apiKeys.id, name: apiKeys.name });

        if (!revoked) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Key not found." });
        }

        await ctx.audit.record(tx, {
          action: "apikey.revoked",
          target: { id: revoked.id, label: revoked.name },
        });
      });

      return { id: input.id };
    }),
});
