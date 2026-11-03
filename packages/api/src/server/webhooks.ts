import { createHmac, randomBytes } from "node:crypto";

import { and, asc, eq, lte, sql } from "@zentro/db/drizzle";
import type { db as Database } from "@zentro/db";
import {
  webhookDeliveries,
  webhookEndpoints,
  type ActivityEvent,
} from "@zentro/db/schema";

import { postSafely } from "./chat-unfurl";

type Handle = Pick<typeof Database, "select" | "insert"> &
  Partial<Pick<typeof Database, "transaction">>;

/** Waits between attempts: 1 minute, then growing, six tries in all. */
const backoffMinutes = [1, 5, 30, 120, 360];
const maxAttempts = backoffMinutes.length + 1;

export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** The signature a receiver recomputes: HMAC-SHA256 of "<time>.<body>". */
export function signWebhook(secret: string, timestamp: number, body: string) {
  return `v1=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;
}

/**
 * What a receiver is told. It names what happened and to what, never the
 * content, so a webhook cannot expose a private project's titles; receivers
 * read details through the API with a key.
 */
export function webhookPayload(event: ActivityEvent) {
  return {
    id: event.id,
    type: event.action,
    createdAt: event.createdAt.toISOString(),
    organizationId: event.organizationId,
    actorUserId: event.actorUserId,
    target: { type: event.targetType, id: event.targetId },
  };
}

/**
 * Queues the event for every endpoint that wants it. It runs in the same
 * transaction as the change, so an event is queued if and only if it happened,
 * and a failure here cannot undo the change (it runs in a savepoint).
 */
export async function enqueueWebhooks(handle: Handle, event: ActivityEvent) {
  const work = async (tx: Handle) => {
    const endpoints = await tx
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.organizationId, event.organizationId),
          eq(webhookEndpoints.enabled, true),
          sql`(jsonb_exists(${webhookEndpoints.events}, ${event.action}) or jsonb_exists(${webhookEndpoints.events}, '*'))`,
        ),
      );

    if (!endpoints.length) return;

    await tx.insert(webhookDeliveries).values(
      endpoints.map((endpoint) => ({
        endpointId: endpoint.id,
        organizationId: event.organizationId,
        event: event.action,
        payload: webhookPayload(event),
      })),
    );
  };

  try {
    if (handle.transaction) {
      await handle.transaction((tx) => work(tx as unknown as Handle));
    } else {
      await work(handle);
    }
  } catch (error) {
    console.error("[webhooks] could not queue an event", error);
  }
}

type Send = (
  url: string,
  body: string,
  headers: Record<string, string>,
) => Promise<number>;

/**
 * Sends what is due. Each row is leased for a few minutes before it is sent,
 * so two workers never send the same delivery, and a crash just retries it.
 */
export async function deliverDueWebhooks(
  db: typeof Database,
  options: { send?: Send; limit?: number; now?: Date } = {},
) {
  const send =
    options.send ?? ((url, body, headers) => postSafely(url, body, headers));
  const now = options.now ?? new Date();
  const due = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "pending"),
        lte(webhookDeliveries.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(webhookDeliveries.nextAttemptAt))
    .limit(options.limit ?? 25);

  let delivered = 0;
  let failed = 0;

  for (const { id } of due) {
    const [claimed] = await db
      .update(webhookDeliveries)
      .set({ nextAttemptAt: new Date(now.getTime() + 5 * 60_000) })
      .where(
        and(
          eq(webhookDeliveries.id, id),
          eq(webhookDeliveries.status, "pending"),
          lte(webhookDeliveries.nextAttemptAt, now),
        ),
      )
      .returning();

    if (!claimed) continue;

    const [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, claimed.endpointId))
      .limit(1);

    if (!endpoint || !endpoint.enabled) {
      await db
        .update(webhookDeliveries)
        .set({ status: "failed", lastError: "Endpoint removed or turned off." })
        .where(eq(webhookDeliveries.id, id));
      continue;
    }

    const body = JSON.stringify(claimed.payload);
    const timestamp = Math.floor(now.getTime() / 1000);
    const attempts = claimed.attempts + 1;
    let status: number | null = null;
    let error: string | null = null;

    try {
      status = await send(endpoint.url, body, {
        "content-type": "application/json",
        "user-agent": "Zentro-Webhooks/1.0",
        "x-zentro-event": claimed.event,
        "x-zentro-delivery": claimed.id,
        "x-zentro-signature": `t=${timestamp},${signWebhook(endpoint.secret, timestamp, body)}`,
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message.slice(0, 300) : "Failed";
    }

    if (status !== null && status >= 200 && status < 300) {
      await db
        .update(webhookDeliveries)
        .set({
          status: "delivered",
          attempts,
          responseStatus: status,
          lastError: null,
          deliveredAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, id));
      delivered += 1;
      continue;
    }

    const exhausted = attempts >= maxAttempts;

    await db
      .update(webhookDeliveries)
      .set({
        status: exhausted ? "failed" : "pending",
        attempts,
        responseStatus: status,
        lastError: error ?? `The receiver answered ${status}.`,
        nextAttemptAt: new Date(
          now.getTime() + (backoffMinutes[attempts - 1] ?? 360) * 60_000,
        ),
      })
      .where(eq(webhookDeliveries.id, id));
    failed += 1;
  }

  return { delivered, failed };
}
