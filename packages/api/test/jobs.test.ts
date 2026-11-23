import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq, like } from "@kyren/db/drizzle";
import { jobs } from "@kyren/db/schema";

import {
  enqueueJob,
  registerJobHandler,
  runDueJobs,
  setJobFailureReporter,
} from "../src/server/jobs";
import { setTicketMailer, mailTicketReply } from "../src/server/ticket-mail";

const tag = `t${Math.random().toString(36).slice(2, 8)}`;
const kind = (name: string) => `test_${tag}_${name}`;
const minutes = (n: number) => n * 60_000;

afterAll(async () => {
  await db.delete(jobs).where(like(jobs.kind, `test_${tag}%`));
  await db.delete(jobs).where(eq(jobs.kind, "ticket_mail"));
  setJobFailureReporter(null);
  setTicketMailer(null);
});

const row = async (id: string) =>
  (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

describe("job queue", () => {
  let reported: string[] = [];

  beforeAll(() => {
    setJobFailureReporter((job) => {
      reported.push(job.kind);
    });
  });
  beforeEach(() => {
    reported = [];
  });

  it("runs a due job once with its payload, then removes it", async () => {
    const seen: unknown[] = [];

    registerJobHandler(kind("once"), async (payload) => {
      seen.push(payload);
    });

    const id = await enqueueJob(db, kind("once"), { hello: "world" });

    expect((await runDueJobs(db)).done).toBeGreaterThanOrEqual(1);
    expect((await runDueJobs(db)).done).toBe(0);
    expect(seen).toEqual([{ hello: "world" }]);
    expect(await row(id)).toBeUndefined();
  });

  it("leaves a job alone until it is due", async () => {
    let ran = 0;

    registerJobHandler(kind("later"), async () => {
      ran += 1;
    });

    const id = await enqueueJob(
      db,
      kind("later"),
      {},
      { runAt: new Date(Date.now() + minutes(10)) },
    );

    await runDueJobs(db);
    expect(ran).toBe(0);
    await runDueJobs(db, new Date(Date.now() + minutes(11)));
    expect(ran).toBe(1);
    expect(await row(id)).toBeUndefined();
  });

  it("retries a failed job later with a growing delay, then succeeds", async () => {
    let calls = 0;

    registerJobHandler(kind("flaky"), async () => {
      calls += 1;

      if (calls < 3) throw new Error(`boom ${calls}`);
    });

    const id = await enqueueJob(db, kind("flaky"), {});

    await runDueJobs(db);

    const first = await row(id);

    expect(first).toMatchObject({ status: "pending", attempts: 1 });
    expect(first!.lastError).toContain("boom 1");
    expect(first!.runAt.getTime()).toBeGreaterThan(Date.now() + minutes(0.5));

    // Not yet due again.
    await runDueJobs(db);
    expect(calls).toBe(1);

    await runDueJobs(db, new Date(Date.now() + minutes(2)));

    const second = await row(id);

    expect(second!.attempts).toBe(2);
    expect(second!.runAt.getTime()).toBeGreaterThan(first!.runAt.getTime());

    await runDueJobs(db, new Date(Date.now() + minutes(60)));
    expect(calls).toBe(3);
    expect(await row(id)).toBeUndefined();
    expect(reported).toEqual([]);
  });

  it("gives up after the last attempt, keeps the job and reports it", async () => {
    registerJobHandler(kind("doomed"), async () => {
      throw new Error("always");
    });

    const id = await enqueueJob(db, kind("doomed"), {}, { maxAttempts: 2 });

    await runDueJobs(db);
    await runDueJobs(db, new Date(Date.now() + minutes(60)));

    expect(await row(id)).toMatchObject({ status: "dead", attempts: 2 });
    expect(reported).toEqual([kind("doomed")]);

    await runDueJobs(db, new Date(Date.now() + minutes(600)));
    expect((await row(id))!.attempts).toBe(2);
  });

  it("never runs a job twice when two runners start together", async () => {
    let calls = 0;

    registerJobHandler(kind("race"), async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await enqueueJob(db, kind("race"), {});
    await Promise.all([runDueJobs(db), runDueJobs(db), runDueJobs(db)]);
    expect(calls).toBe(1);
  });

  it("does not touch jobs this server has no handler for", async () => {
    const id = await enqueueJob(db, kind("unknown"), {});

    await runDueJobs(db);
    expect(await row(id)).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("queues an email again when sending it fails, and sends it on retry", async () => {
    const sent: string[] = [];
    let down = true;

    setTicketMailer(async (mail) => {
      if (down) throw new Error("mail is down");

      sent.push(mail.to);
    });

    await mailTicketReply(
      {
        number: 7,
        subject: "Help",
        requesterEmail: `rin-${tag}@customer.example`,
        portalToken: "a".repeat(64),
      },
      "We fixed it",
      db,
    );
    expect(sent).toEqual([]);

    down = false;
    await runDueJobs(db, new Date(Date.now() + minutes(60)));
    expect(sent).toEqual([`rin-${tag}@customer.example`]);
  });
});
