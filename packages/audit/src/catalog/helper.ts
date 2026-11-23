import type { AuditEventDefinition, AuditModule, AuditTargetType } from "../types";

export function event(
  key: string,
  label: string,
  module: AuditModule,
  targetType: AuditTargetType,
  auditOnly: boolean,
  phrase: string,
  description: string,
  hookOnly?: string,
): AuditEventDefinition {
  return {
    key,
    label,
    module,
    targetType,
    auditOnly,
    description,
    phrase,
    ...(hookOnly ? { hookOnly } : {}),
  };
}

export const auth = (
  key: string,
  label: string,
  targetType: AuditTargetType,
  phrase: string,
  description: string,
  hook: string,
) => event(key, label, "platform", targetType, true, phrase, description, hook);
