import type { db } from "@zentro/db";
import { activityEvents, type ActivityEvent } from "@zentro/db/schema";

import { getAuditEvent } from "./catalog";
import { maxChangeLength } from "./diff";
import { redactSecrets } from "./redact";
import type { AuditChange } from "./types";

/** A database or transaction handle: everything an event insert needs. */
export type AuditHandle = Pick<typeof db, "insert">;

export type AuditRequestContext = {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export type RecordEventInput = {
  organizationId: string;
  /** Null when the system acted. */
  actorUserId: string | null;
  /** A key of the event catalog. */
  action: string;
  target: { id: string; label?: string | null };
  projectId?: string | null;
  teamId?: string | null;
  changes?: AuditChange[];
  /** Extra context. Secret-looking keys are removed before it is stored. */
  metadata?: Record<string, unknown>;
  request?: AuditRequestContext;
};

const maxLabelLength = 300;
const maxUserAgentLength = 500;

function shorten(value: string | null | undefined, max: number) {
  if (!value) {
    return null;
  }

  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * The headers a client's address is read from, in order. Only a header the
 * proxy in front of Zentro sets itself (and overwrites) can be trusted: on
 * Vercel that is the platform's own pair; behind your own proxy, set
 * `CLIENT_IP_HEADERS=x-real-ip` and have the proxy write `X-Real-IP`.
 */
export function clientIpHeaders() {
  const configured = process.env.CLIENT_IP_HEADERS?.split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  return configured?.length
    ? configured
    : ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"];
}

/** The client's address from the trusted headers (a list's first entry). */
export function clientIpFrom(headers: Headers | undefined | null) {
  for (const name of clientIpHeaders()) {
    const value = headers?.get(name)?.split(",")[0]?.trim();

    if (value) return value;
  }

  return null;
}

export function requestContextFromHeaders(
  headers: Headers | undefined | null,
  requestId?: string,
): AuditRequestContext {
  return {
    ip: clientIpFrom(headers),
    userAgent: shorten(headers?.get("user-agent"), maxUserAgentLength),
    requestId: requestId ?? null,
  };
}

/**
 * Writes one event. Pass the transaction that makes the change, so the event
 * exists exactly when the change does.
 */
export async function insertActivityEvent(
  handle: AuditHandle,
  input: RecordEventInput,
): Promise<ActivityEvent> {
  const definition = getAuditEvent(input.action);

  if (!definition) {
    throw new Error(`Unknown audit event ${input.action}.`);
  }

  const changes = input.changes?.map((change) => ({
    field: change.field,
    from: shorten(change.from, maxChangeLength),
    to: shorten(change.to, maxChangeLength),
  }));
  const metadata = redactSecrets({
    ...input.metadata,
    ...(changes?.length ? { changes } : {}),
  });

  const [row] = await handle
    .insert(activityEvents)
    .values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: definition.key,
      targetType: definition.targetType,
      targetId: input.target.id,
      targetLabel: shorten(input.target.label, maxLabelLength),
      projectId: input.projectId ?? null,
      teamId: input.teamId ?? null,
      auditOnly: definition.auditOnly,
      metadata,
      ip: input.request?.ip ?? null,
      userAgent: input.request?.userAgent ?? null,
      requestId: input.request?.requestId ?? null,
    })
    .returning();

  return row!;
}
