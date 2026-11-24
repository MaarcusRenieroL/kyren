import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import * as schema from "../schema";
import { dbEnv } from "../env";

const isVercel = process.env.VERCEL === "1";
const configuredMax = Number(process.env.DATABASE_POOL_MAX);
const defaultMax = isVercel ? 5 : 20;

// Each Vercel function instance has its own pool. Keep its default small
// because all instances share the database's connection budget.
const pool = new Pool({
  connectionString: dbEnv.DATABASE_URL,
  max:
    Number.isSafeInteger(configuredMax) && configuredMax > 0
      ? configuredMax
      : defaultMax,
  ...(isVercel && { idleTimeoutMillis: 5_000 }),
});

if (isVercel) {
  attachDatabasePool(pool);
}

export const db = drizzle({
  client: pool,
  schema,
});
