import { TRPCError } from "@trpc/server";
import { getAuditEvent } from "@zentro/audit";
import { and, desc, eq } from "@zentro/db/drizzle";
import { webhookDeliveries, webhookEndpoints } from "@zentro/db/schema";
import { z } from "zod";

import { isSafeUrl } from "../chat-unfurl";
import { permissionProcedure, router } from "../trpc";
import { uuid } from "../zod-common";
import { generateWebhookSecret } from "../webhooks";

const procedure = (permission: string, audit?: string[]) =>
  permissionProcedure(permission, undefined, { module: "admin", audit });

const production = () => process.env.NODE_ENV === "production";

export const webhookRouter = router({
  list: procedure("admin.manage_webhooks").query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        enabled: webhookEndpoints.enabled,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.organizationId, ctx.activeOrganization.id))
      .orderBy(desc(webhookEndpoints.createdAt));
  }),

  /** The signing secret comes back once, here, and is never listed. */
  create: procedure("admin.manage_webhooks", ["webhook.created"])
    .input(
      z.object({
        url: z.string().trim().url().max(500),
        events: z.array(z.string().max(60)).min(1).max(60).default(["*"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const url = new URL(input.url);

      if (
        url.protocol !== "https:" &&
        (production() || url.protocol !== "http:")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use an https address.",
        });
      }

      if (!(await isSafeUrl(input.url))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That address can't be reached from here. Use a public address.",
        });
      }

      const unknown = input.events.find(
        (event) => event !== "*" && !getAuditEvent(event),
      );

      if (unknown) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown event "${unknown}".`,
        });
      }

      const secret = generateWebhookSecret();

      const id = await ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(webhookEndpoints)
          .values({
            organizationId: ctx.activeOrganization.id,
            createdByUserId: ctx.user.id,
            url: input.url,
            secret,
            events: [...new Set(input.events)],
          })
          .returning({ id: webhookEndpoints.id });

        await ctx.audit.record(tx, {
          action: "webhook.created",
          target: { id: created!.id, label: url.host },
        });

        return created!.id;
      });

      return { id, secret };
    }),

  setEnabled: procedure("admin.manage_webhooks", ["webhook.updated"])
    .input(z.object({ id: uuid, enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(webhookEndpoints)
          .set({ enabled: input.enabled })
          .where(
            and(
              eq(webhookEndpoints.id, input.id),
              eq(webhookEndpoints.organizationId, ctx.activeOrganization.id),
            ),
          )
          .returning({ id: webhookEndpoints.id, url: webhookEndpoints.url });

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Webhook not found.",
          });
        }

        await ctx.audit.record(tx, {
          action: "webhook.updated",
          target: { id: updated.id, label: new URL(updated.url).host },
          metadata: { enabled: input.enabled },
        });
      });

      return { id: input.id };
    }),

  remove: procedure("admin.manage_webhooks", ["webhook.deleted"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [removed] = await tx
          .delete(webhookEndpoints)
          .where(
            and(
              eq(webhookEndpoints.id, input.id),
              eq(webhookEndpoints.organizationId, ctx.activeOrganization.id),
            ),
          )
          .returning({ id: webhookEndpoints.id, url: webhookEndpoints.url });

        if (!removed) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Webhook not found.",
          });
        }

        await ctx.audit.record(tx, {
          action: "webhook.deleted",
          target: { id: removed.id, label: new URL(removed.url).host },
        });
      });

      return { id: input.id };
    }),

  deliveries: procedure("admin.manage_webhooks")
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: webhookDeliveries.id,
          event: webhookDeliveries.event,
          status: webhookDeliveries.status,
          attempts: webhookDeliveries.attempts,
          responseStatus: webhookDeliveries.responseStatus,
          lastError: webhookDeliveries.lastError,
          createdAt: webhookDeliveries.createdAt,
        })
        .from(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.endpointId, input.id),
            eq(webhookDeliveries.organizationId, ctx.activeOrganization.id),
          ),
        )
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50);
    }),
});
