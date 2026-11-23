import type { AuditEventDefinition } from "./types";
import { authEvents } from "./catalog/auth-events";
import { workEvents } from "./catalog/work-events";
import { chatEvents } from "./catalog/chat-events";
import { collabEvents } from "./catalog/collab-events";
import { ticketsEvents } from "./catalog/tickets-events";
import { enterpriseEvents } from "./catalog/enterprise-events";

export const auditCatalog: readonly AuditEventDefinition[] = [
  ...authEvents,
  ...workEvents,
  ...chatEvents,
  ...collabEvents,
  ...ticketsEvents,
  ...enterpriseEvents,
] as const;

const index = new Map(auditCatalog.map((entry) => [entry.key, entry]));

export function getAuditEvent(key: string) {
  return index.get(key);
}

export function isKnownAuditEvent(key: string) {
  return index.has(key);
}

export function getAuditEventKeys() {
  return auditCatalog.map((entry) => entry.key);
}
