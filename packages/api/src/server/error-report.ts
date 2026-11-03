const SECRET_KEY = /pass|secret|token|key|authorization|cookie/i;
const WINDOW_MS = 60_000;

const lastSent = new Map<string, number>();

/** For tests: forgets which errors were already posted. */
export function resetErrorThrottle() {
  lastSent.clear();
}

function scrub(context: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(context ?? {}).map(([key, value]) => [
      key,
      SECRET_KEY.test(key) ? "[hidden]" : value,
    ]),
  );
}

/**
 * Records a server error: always to the log, and, when ERROR_WEBHOOK_URL is
 * set (a Slack-style incoming webhook), to that address too, at most once a
 * minute for the same error. It never throws, so reporting cannot add a failure.
 */
export async function reportError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const safe = scrub(context);

    console.error(
      JSON.stringify({
        level: "error",
        scope,
        message,
        stack: error instanceof Error ? error.stack : undefined,
        ...safe,
      }),
    );

    const url = process.env.ERROR_WEBHOOK_URL;

    if (!url) return;

    const key = `${scope}:${message}`;
    const now = Date.now();

    if (now - (lastSent.get(key) ?? 0) < WINDOW_MS) return;

    lastSent.set(key, now);

    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `[zentro] ${scope}: ${message}`,
        scope,
        message,
        ...safe,
      }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Reporting must never cause a second failure.
  }
}
