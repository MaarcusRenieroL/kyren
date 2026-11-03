import { TRPCError } from "@trpc/server";

type Bucket = { count: number; resetAt: number };

const windowMs = 60_000;
const buckets = new Map<string, Bucket>();

function limitFor(type: "query" | "mutation" | "subscription") {
  const override = Number(
    type === "mutation"
      ? process.env.API_MUTATIONS_PER_MINUTE
      : process.env.API_QUERIES_PER_MINUTE,
  );

  if (Number.isFinite(override) && override > 0) {
    return override;
  }

  // Tests drive thousands of calls through one process.
  if (process.env.NODE_ENV === "test") {
    return Number.MAX_SAFE_INTEGER;
  }

  return type === "mutation" ? 300 : 1500;
}

/**
 * A per-process, per-user ceiling on API calls a minute. It needs no database
 * round trip, so it can sit in front of every procedure; the Postgres limiter
 * is kept for the endpoints where an exact shared count matters.
 */
export function enforceBurstLimit(
  userId: string,
  type: "query" | "mutation" | "subscription",
  now = Date.now(),
) {
  const key = `${userId}:${type === "mutation" ? "m" : "q"}`;
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);

    // Drop stale buckets now and then so the map cannot grow without bound.
    if (buckets.size > 5000) {
      for (const [id, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(id);
      }
    }
  }

  bucket.count += 1;

  if (bucket.count > limitFor(type)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many requests. Try again in ${Math.ceil((bucket.resetAt - now) / 1000)} seconds.`,
    });
  }
}

export function resetBurstLimits() {
  buckets.clear();
}
