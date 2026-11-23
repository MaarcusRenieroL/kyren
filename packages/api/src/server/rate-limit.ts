import { TRPCError } from "@trpc/server";
import { hit } from "@kyren/db/rate-limit";

type Database = Parameters<typeof hit>[0];
type Options = Parameters<typeof hit>[2];

export { hit };

/** Throws TOO_MANY_REQUESTS when `key` has used up its calls for the window. */
export async function enforceRateLimit(
  db: Database,
  key: string,
  options: Options,
) {
  const result = await hit(db, key, options);

  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many requests. Try again in ${result.retryAfterSeconds} seconds.`,
    });
  }
}
