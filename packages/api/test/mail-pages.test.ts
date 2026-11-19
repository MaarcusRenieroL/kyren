import { randomUUID } from "node:crypto";

import { db } from "@zentro/db";
import { sql } from "@zentro/db/drizzle";
import { mailMessages, mailRecipients } from "@zentro/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("mail folders come in pages", () => {
  it("pages through every message once, even ones sharing a millisecond at the cut", async () => {
    const org = await world.org("Mail pages");
    const a = await world.userIn(org, "owner", "Sender");
    const b = await world.userIn(org, "member", "Reader");
    const base = Date.now();

    for (let index = 0; index < 120; index += 1) {
      const id = randomUUID();
      // Eleven share one millisecond, right where the first page ends.
      const at = new Date(
        index >= 45 && index <= 55 ? base - 50_000 : base - index * 1000,
      );

      await db.insert(mailMessages).values({
        id,
        organizationId: org.id,
        senderMemberId: a.member.id,
        threadId: id,
        subject: `Message ${index}`,
        body: "",
        sentAt: at,
      });
      await db
        .insert(mailRecipients)
        .values({ messageId: id, memberId: b.member.id, kind: "to" });
    }

    // Rows written by the database clock carry microseconds too.
    await db.execute(
      sql`update ${mailMessages} set "sentAt" = "sentAt" + (random() * 900)::int * interval '1 microsecond' where ${mailMessages.organizationId} = ${org.id}`,
    );

    const reader = await world.caller(b.user, org);
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const page = await reader.mail.list({ folder: "inbox", cursor });

      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
  });
});
