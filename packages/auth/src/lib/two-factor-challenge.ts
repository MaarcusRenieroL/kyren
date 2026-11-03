import { createHash } from "node:crypto";

/**
 * A short fingerprint of the pending two-factor challenge in a request's
 * cookies, or null when there is none. Only the hash is ever stored.
 */
export function twoFactorChallenge(cookieHeader: string | null | undefined) {
  const match = /(?:^|;\s*)(?:__Secure-)?[\w.-]*two_factor=([^;]+)/.exec(
    cookieHeader ?? "",
  );

  return match
    ? createHash("sha256").update(match[1]!).digest("hex").slice(0, 32)
    : null;
}
