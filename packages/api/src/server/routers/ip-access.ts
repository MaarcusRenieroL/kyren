import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "@kyren/db/drizzle";
import { ipAllowlist, organizations } from "@kyren/db/schema";
import { z } from "zod";

import { clientIp } from "../client-ip";
import { forgetIpPolicy, ipMatches, isValidCidr } from "../ip-policy";
import { permissionProcedure, router } from "../trpc";

const procedure = (audit?: string[]) =>
  permissionProcedure("admin.manage_ip_access", undefined, {
    module: "admin",
    audit,
  });

const lockout = new TRPCError({
  code: "BAD_REQUEST",
  message: "That would lock you out: your own address must stay allowed.",
});

export const ipAccessRouter = router({
  get: procedure().query(async ({ ctx }) => {
    const organizationId = ctx.activeOrganization.id;
    const entries = await ctx.db
      .select({
        id: ipAllowlist.id,
        cidr: ipAllowlist.cidr,
        label: ipAllowlist.label,
      })
      .from(ipAllowlist)
      .where(eq(ipAllowlist.organizationId, organizationId))
      .orderBy(asc(ipAllowlist.createdAt));
    const [org] = await ctx.db
      .select({ enabled: organizations.ipAllowlistEnabled })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    return {
      enabled: org?.enabled ?? false,
      entries,
      yourIp: clientIp(ctx.headers),
    };
  }),

  add: procedure(["ipaccess.changed"])
    .input(
      z.object({
        cidr: z
          .string()
          .trim()
          .max(60)
          .refine(
            isValidCidr,
            "Enter an address or a range like 203.0.113.0/24.",
          ),
        label: z.string().trim().max(80).default(""),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(ipAllowlist)
          .values({
            organizationId: ctx.activeOrganization.id,
            cidr: input.cidr,
            label: input.label,
          })
          .returning();

        await ctx.audit.record(tx, {
          action: "ipaccess.changed",
          target: {
            id: ctx.activeOrganization.id,
            label: `added ${input.cidr}`,
          },
        });
        forgetIpPolicy(ctx.activeOrganization.id);

        return row!;
      }),
    ),

  remove: procedure(["ipaccess.changed"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const organizationId = ctx.activeOrganization.id;
        const entries = await tx
          .select()
          .from(ipAllowlist)
          .where(eq(ipAllowlist.organizationId, organizationId));
        const target = entries.find((entry) => entry.id === input.id);

        if (!target) throw new TRPCError({ code: "NOT_FOUND" });

        const [org] = await tx
          .select({ enabled: organizations.ipAllowlistEnabled })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);
        const ip = clientIp(ctx.headers);
        const stillAllowed =
          ip !== null &&
          entries.some(
            (entry) => entry.id !== input.id && ipMatches(ip, entry.cidr),
          );

        if (org?.enabled && !stillAllowed) throw lockout;

        await tx
          .delete(ipAllowlist)
          .where(
            and(
              eq(ipAllowlist.id, input.id),
              eq(ipAllowlist.organizationId, organizationId),
            ),
          );
        await ctx.audit.record(tx, {
          action: "ipaccess.changed",
          target: { id: organizationId, label: `removed ${target.cidr}` },
        });
        forgetIpPolicy(organizationId);

        return { ok: true };
      }),
    ),

  /** Switches the allow-list on or off. Turning it on needs the caller's own address in it. */
  setEnabled: procedure(["ipaccess.changed"])
    .input(z.object({ enabled: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const organizationId = ctx.activeOrganization.id;

        if (input.enabled) {
          const entries = await tx
            .select({ cidr: ipAllowlist.cidr })
            .from(ipAllowlist)
            .where(eq(ipAllowlist.organizationId, organizationId));
          const ip = clientIp(ctx.headers);

          if (!ip || !entries.some((entry) => ipMatches(ip, entry.cidr))) {
            throw lockout;
          }
        }

        await tx
          .update(organizations)
          .set({ ipAllowlistEnabled: input.enabled })
          .where(eq(organizations.id, organizationId));
        await ctx.audit.record(tx, {
          action: "ipaccess.changed",
          target: {
            id: organizationId,
            label: input.enabled ? "switched on" : "switched off",
          },
        });
        forgetIpPolicy(organizationId);

        return { enabled: input.enabled };
      }),
    ),
});
