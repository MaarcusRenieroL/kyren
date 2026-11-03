import { createHash } from "node:crypto";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const fields: Record<string, string> = {
  "/sign-up/email": "password",
  "/change-password": "newPassword",
  "/reset-password": "newPassword",
};

/** The body field that carries a new password, or null for other endpoints. */
export function passwordFieldFor(path: string) {
  return fields[path] ?? null;
}

/**
 * Whether a password appears in the Have I Been Pwned corpus. Only the first
 * five characters of its SHA-1 hash leave the server. If the service is slow
 * or down this answers false, so a third-party outage never blocks sign-up.
 */
export async function isBreachedPassword(
  password: string,
  fetcher: Fetcher = fetch,
) {
  const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha.slice(0, 5);
  const suffix = sha.slice(5);

  try {
    const response = await fetcher(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: { "Add-Padding": "true" },
        signal: AbortSignal.timeout(2500),
      },
    );

    if (!response.ok) return false;

    for (const line of (await response.text()).split(/\r?\n/)) {
      const [hash, count] = line.split(":");

      if (hash?.toUpperCase() === suffix) {
        return Number(count) > 0;
      }
    }

    return false;
  } catch {
    return false;
  }
}
