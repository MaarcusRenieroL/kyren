import { requestContextFromHeaders } from "@zentro/audit/server";

/** The caller's address, from the trusted headers (see `clientIpHeaders`). */
export function clientIp(headers: Headers | undefined | null) {
  return requestContextFromHeaders(headers).ip ?? null;
}
