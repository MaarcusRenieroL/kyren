import { randomUUID } from "node:crypto";

import { db } from "@zentro/db";
import { inArray } from "@zentro/db/drizzle";
import {
  chatAttachments,
  chatChannels,
  chatEmojis,
  chatMessages,
  files,
  legalHolds,
} from "@zentro/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { purgeDeletedFiles } from "../src/server/file-purge";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const DAY = 86_400_000;

describe("deleted files", () => {
  it("lose their bytes after 30 days, unless held or still used by an emoji", async () => {
    const org = await world.org("Purge Co");
    const held = await world.org("Held Co");
    const ago = (days: number) => new Date(Date.now() - days * DAY);
    const add = async (
      organizationId: string,
      deletedAt: Date | null,
      label: string,
    ) => {
      const [row] = await db
        .insert(files)
        .values({
          organizationId,
          name: `${label}.txt`,
          mimeType: "text/plain",
          size: 10,
          storageKey: `test/${label}-${randomUUID()}`,
          deletedAt,
        })
        .returning();

      return row!;
    };

    const old = await add(org.id, ago(40), "old");
    const recent = await add(org.id, ago(5), "recent");
    const live = await add(org.id, null, "live");
    const emoji = await add(org.id, ago(40), "emoji");
    const onHold = await add(held.id, ago(40), "held");
    const attached = await add(org.id, ago(40), "attached");
    const stuck = await add(org.id, ago(40), "stuck");

    await db
      .insert(chatEmojis)
      .values({ organizationId: org.id, name: "party", fileId: emoji.id });
    await db
      .insert(legalHolds)
      .values({ organizationId: held.id, reason: "Litigation" });

    // A live message still carries one deleted file.
    const [channel] = await db
      .insert(chatChannels)
      .values({
        organizationId: org.id,
        name: `purge-${Date.now()}`,
        kind: "channel",
      })
      .returning();
    const [message] = await db
      .insert(chatMessages)
      .values({
        organizationId: org.id,
        channelId: channel!.id,
        body: "see file",
      })
      .returning();

    await db
      .insert(chatAttachments)
      .values({ messageId: message!.id, fileId: attached.id });

    const ours = [old, recent, live, emoji, onHold, attached, stuck].map(
      (file) => file.id,
    );
    const removed: string[] = [];

    // A storage failure keeps the records, so the next run retries.
    await purgeDeletedFiles(db, {
      removeFiles: async () => {
        throw new Error("storage down");
      },
    });
    expect(
      (await db.select().from(files).where(inArray(files.id, ours))).length,
    ).toBe(7);

    // One object that can never be removed doesn't hold up the others.
    await purgeDeletedFiles(db, {
      removeFiles: async (keys) => {
        if (keys.includes(stuck.storageKey)) throw new Error("stuck");
        removed.push(...keys);
      },
    });

    const left = (
      await db
        .select({ id: files.id })
        .from(files)
        .where(inArray(files.id, ours))
    ).map((row) => row.id);

    expect(removed).toContain(old.storageKey);
    expect(removed).not.toContain(recent.storageKey);
    expect(removed).not.toContain(emoji.storageKey);
    expect(removed).not.toContain(onHold.storageKey);
    expect(removed).not.toContain(attached.storageKey);
    expect(left.sort()).toEqual(
      [recent.id, live.id, emoji.id, onHold.id, attached.id, stuck.id].sort(),
    );
  });
});
