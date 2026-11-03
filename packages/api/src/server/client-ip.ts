import { requestContextFromHeaders } from "@zentro/audit/server";

/** The caller's address as the audit log reads it: the first `x-forwarded-for` entry. */
export function clientIp(headers: Headers | undefined | null) {
  return requestContextFromHeaders(headers).ip ?? null;
}
