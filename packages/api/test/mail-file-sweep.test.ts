import { db } from "@zentro/db";
import { inArray } from "@zentro/db/drizzle";
import { files } from "@zentro/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { retireUnsentMailFiles } from "../src/server/file-purge";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const HOUR = 3_600_000;

describe("unsent mail uploads", () => {
  it("are deleted after a day when no message carries them", async () => {
    const org = await world.org("Mail sweep");
    const a = await world.userIn(org, "owner", "Sweep Sender");
    const b = await world.userIn(org, "member", "Sweep Reader");
    const ana = await world.caller(a.user, org);
    const upload = (name: string) =>
      ana.files.mailRegister({
        name,
        mimeType: "application/pdf",
        size: 10,
        storageKey: `${org.id}/${name}-${Math.random().toString(36).slice(2)}`,
      });

    const onDraft = await upload("draft.pdf");
    const sent = await upload("sent.pdf");
    const dropped = await upload("dropped.pdf");

    await ana.mail.saveDraft({
      to: [b.member.id],
      subject: "Draft",
      body: "x",
      fileIds: [onDraft.id],
    });
    await ana.mail.send({
      to: [b.member.id],
      subject: "Sent",
      body: "x",
      fileIds: [sent.id],
    });

    const deletedAt = async () => {
      const rows = await db
        .select({ id: files.id, deletedAt: files.deletedAt })
        .from(files)
        .where(inArray(files.id, [onDraft.id, sent.id, dropped.id]));

      return new Map(rows.map((row) => [row.id, row.deletedAt]));
    };

    // Within the first day nothing is touched, carried or not.
    await retireUnsentMailFiles(db, { now: new Date() });
    expect([...(await deletedAt()).values()]).toEqual([null, null, null]);

    // A day later (only these files are aged, so tests running alongside
    // keep their fresh uploads).
    await db
      .update(files)
      .set({ createdAt: new Date(Date.now() - 25 * HOUR) })
      .where(inArray(files.id, [onDraft.id, sent.id, dropped.id]));
    await retireUnsentMailFiles(db);

    const deleted = await deletedAt();

    expect(deleted.get(dropped.id)).not.toBeNull();
    expect(deleted.get(onDraft.id)).toBeNull();
    expect(deleted.get(sent.id)).toBeNull();
  });
});
