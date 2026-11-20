import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import * as schema from "../schema";
import { dbEnv } from "../env";

// One long-running server (a VM) shares this pool across every request, so it
// needs more than pg's default of 10; Postgres allows 100 by default.
const pool = new Pool({
  connectionString: dbEnv.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX) || 20,
});

// On Vercel, the pool is closed cleanly when a function instance is suspended
// so idle connections do not pile up on the Neon pooler.
if (process.env.VERCEL) {
  attachDatabasePool(pool);
}

export const db = drizzle({
  client: pool,
  schema,
});
