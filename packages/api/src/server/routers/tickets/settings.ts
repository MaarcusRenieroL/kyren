import { randomBytes } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "@zentro/db/drizzle";
import {
  members,
  ticketAssignmentRules,
  ticketInboxes,
  ticketSlaPolicies,
} from "@zentro/db/schema";
import { z } from "zod";

import {
  assignmentModes,
  type AssignmentMode,
  procedure,
  ticketPriorities,
  uuid,
} from "./types";

export const ticketSettingsProcedures = {
  /** The response and resolution targets per priority. */
  slaPolicy: procedure("tickets.view").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        priority: ticketSlaPolicies.priority,
        firstResponseMinutes: ticketSlaPolicies.firstResponseMinutes,
        resolutionMinutes: ticketSlaPolicies.resolutionMinutes,
      })
      .from(ticketSlaPolicies)
      .where(eq(ticketSlaPolicies.organizationId, ctx.activeOrganization.id));

    return rows.sort(
      (a, b) =>
        ticketPriorities.indexOf(b.priority as never) -
        ticketPriorities.indexOf(a.priority as never),
    );
  }),

  /** The support email address, for people who manage it. */
  inbox: procedure("tickets.manage_inbox").query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(ticketInboxes)
      .where(eq(ticketInboxes.organizationId, ctx.activeOrganization.id))
      .limit(1);

    return { enabled: row?.enabled ?? false, token: row?.token ?? null };
  }),

  /** Turns email to ticket on or off. `rotate` replaces the address, retiring the old one. */
  setInbox: procedure("tickets.manage_inbox", ["ticket.inbox_changed"])
    .input(z.object({ enabled: z.boolean(), rotate: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const token = randomBytes(24).toString("hex");

      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(ticketInboxes)
          .values({
            organizationId: ctx.activeOrganization.id,
            token,
            enabled: input.enabled,
          })
          .onConflictDoUpdate({
            target: ticketInboxes.organizationId,
            set: {
              enabled: input.enabled,
              ...(input.rotate ? { token } : {}),
            },
          })
          .returning();

        await ctx.audit.record(tx, {
          action: "ticket.inbox_changed",
          target: {
            id: ctx.activeOrganization.id,
            label: input.rotate
              ? "replaced the address"
              : input.enabled
                ? "turned on"
                : "turned off",
          },
        });

        return { enabled: row!.enabled, token: row!.token };
      });
    }),

  /** Who new tickets from email and forms go to, in turn. */
  assignmentRule: procedure("tickets.manage_inbox").query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(ticketAssignmentRules)
      .where(
        eq(ticketAssignmentRules.organizationId, ctx.activeOrganization.id),
      )
      .limit(1);

    return {
      enabled: row?.enabled ?? false,
      memberIds: row?.memberIds ?? [],
      mode: (row?.mode ?? "round_robin") as AssignmentMode,
    };
  }),

  setAssignmentRule: procedure("tickets.manage_inbox", [
    "ticket.assignment_changed",
  ])
    .input(
      z.object({
        enabled: z.boolean(),
        memberIds: z.array(uuid).max(100),
        /** Left out, the current mode stays. */
        mode: z.enum(assignmentModes).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // People who have left since they were picked drop out quietly; anyone
      // else must be a member now.
      const [stored] = await ctx.db
        .select({
          memberIds: ticketAssignmentRules.memberIds,
          mode: ticketAssignmentRules.mode,
        })
        .from(ticketAssignmentRules)
        .where(
          eq(ticketAssignmentRules.organizationId, ctx.activeOrganization.id),
        )
        .limit(1);
      const requested = [...new Set(input.memberIds)];
      const current = new Set(
        requested.length
          ? (
              await ctx.db
                .select({ id: members.id })
                .from(members)
                .where(
                  and(
                    eq(members.organizationId, ctx.activeOrganization.id),
                    inArray(members.id, requested),
                  ),
                )
            ).map((row) => row.id)
          : [],
      );
      const memberIds = requested.filter(
        (id) => current.has(id) || !stored?.memberIds.includes(id),
      );
      const known = memberIds.length
        ? await ctx.db
            .select({ id: members.id })
            .from(members)
            .where(
              and(
                eq(members.organizationId, ctx.activeOrganization.id),
                inArray(members.id, memberIds),
              ),
            )
        : [];

      if (known.length !== memberIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Everyone in the rotation must be in this organization.",
        });
      }

      if (input.enabled && !memberIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick at least one person to assign tickets to.",
        });
      }

      const mode =
        input.mode ??
        (stored?.mode as AssignmentMode | undefined) ??
        "round_robin";

      return ctx.db.transaction(async (tx) => {
        await tx
          .insert(ticketAssignmentRules)
          .values({
            organizationId: ctx.activeOrganization.id,
            enabled: input.enabled,
            memberIds,
            mode,
          })
          .onConflictDoUpdate({
            target: ticketAssignmentRules.organizationId,
            set: {
              enabled: input.enabled,
              memberIds,
              mode,
              updatedAt: new Date(),
            },
          });

        await ctx.audit.record(tx, {
          action: "ticket.assignment_changed",
          target: {
            id: ctx.activeOrganization.id,
            label: input.enabled
              ? `rotation of ${memberIds.length}`
              : "turned off",
          },
          metadata: { enabled: input.enabled, memberIds, mode },
        });

        return { enabled: input.enabled, memberIds, mode };
      });
    }),

  setSla: procedure("tickets.manage_sla", ["ticket.sla_updated"])
    .input(
      z.object({
        priority: z.enum(ticketPriorities),
        firstResponseMinutes: z.number().int().min(1).max(525_600).nullable(),
        resolutionMinutes: z.number().int().min(1).max(525_600).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { firstResponseMinutes: first, resolutionMinutes: last } = input;

      if (first !== null && last !== null && last < first) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Resolving cannot be due before the first answer.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        if (first === null && last === null) {
          await tx
            .delete(ticketSlaPolicies)
            .where(
              and(
                eq(ticketSlaPolicies.organizationId, ctx.activeOrganization.id),
                eq(ticketSlaPolicies.priority, input.priority),
              ),
            );
        } else {
          await tx
            .insert(ticketSlaPolicies)
            .values({
              organizationId: ctx.activeOrganization.id,
              priority: input.priority,
              firstResponseMinutes: first,
              resolutionMinutes: last,
            })
            .onConflictDoUpdate({
              target: [
                ticketSlaPolicies.organizationId,
                ticketSlaPolicies.priority,
              ],
              set: {
                firstResponseMinutes: first,
                resolutionMinutes: last,
                updatedAt: new Date(),
              },
            });
        }

        await ctx.audit.record(tx, {
          action: "ticket.sla_updated",
          target: {
            id: ctx.activeOrganization.id,
            label: `${input.priority} priority`,
          },
        });
      });

      return { priority: input.priority };
    }),
};
