import { and, asc, eq, inArray, lte } from "@zentro/db/drizzle";
import { jobs } from "@zentro/db/schema";

import type { db as database } from "@zentro/db";

import { reportError } from "./error-report";

type Db = typeof database;
type Job = typeof jobs.$inferSelect;
type Handler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, Handler>();

/** Wait before attempt n+1: 1 minute, 5, 30, 2 hours, 12 hours. */
const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];
/** How long a claimed job is hidden from other runners, in case this one dies. */
const LEASE_MS = 5 * 60_000;
const BATCH = 20;

export function registerJobHandler(kind: string, handler: Handler) {
  handlers.set(kind, handler);
}

let failureReporter:
  | ((job: Job, error: unknown) => void | Promise<void>)
  | null = null;

/** Replaces what happens when a job gives up (tests); null restores reporting. */
export function setJobFailureReporter(
  reporter: ((job: Job, error: unknown) => void | Promise<void>) | null,
) {
  failureReporter = reporter;
}

export async function enqueueJob(
  db: Db,
  kind: string,
  payload: Record<string, unknown>,
  options: { runAt?: Date; maxAttempts?: number } = {},
) {
  const [row] = await db
    .insert(jobs)
    .values({
      kind,
      payload,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? 5,
    })
    .returning({ id: jobs.id });

  return row!.id;
}

/**
 * Runs the jobs that are due and that this server knows how to do. Each is
 * claimed first (hidden for a few minutes) so two runners never do the same
 * one, then deleted when it succeeds or retried later with a longer delay.
 */
export async function runDueJobs(db: Db, now = new Date()) {
  const kinds = [...handlers.keys()];
  const result = { done: 0, retried: 0, dead: 0 };

  if (!kinds.length) return result;

  const claimed = await db.transaction(async (tx) => {
    const due = await tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.status, "pending"),
          lte(jobs.runAt, now),
          inArray(jobs.kind, kinds),
        ),
      )
      .orderBy(asc(jobs.runAt))
      .limit(BATCH)
      .for("update", { skipLocked: true });

    if (!due.length) return [];

    const lease = new Date(now.getTime() + LEASE_MS);
    const rows = [];

    for (const { id } of due) {
      const [row] = await tx
        .update(jobs)
        .set({ runAt: lease })
        .where(eq(jobs.id, id))
        .returning();

      rows.push(row!);
    }

    return rows;
  });

  for (const job of claimed) {
    const attempts = job.attempts + 1;

    try {
      await handlers.get(job.kind)!(job.payload);
      await db.delete(jobs).where(eq(jobs.id, job.id));
      result.done += 1;
    } catch (error) {
      const message = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 1000);

      if (attempts >= job.maxAttempts) {
        await db
          .update(jobs)
          .set({ status: "dead", attempts, lastError: message })
          .where(eq(jobs.id, job.id));
        result.dead += 1;

        if (failureReporter) await failureReporter(job, error);
        else
          await reportError("jobs", error, { kind: job.kind, jobId: job.id });
      } else {
        const wait = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!;

        await db
          .update(jobs)
          .set({
            attempts,
            lastError: message,
            runAt: new Date(now.getTime() + wait),
          })
          .where(eq(jobs.id, job.id));
        result.retried += 1;
      }
    }
  }

  return result;
}
