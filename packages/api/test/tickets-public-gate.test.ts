import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { organizations, tickets } from "@zentro/db/schema";

import { publicArticles } from "../src/server/kb-public";
import { forgetOrganizationStatus } from "../src/server/platform-policy";
import { portalReply, portalView } from "../src/server/ticket-portal";
import { receiveTicketMail } from "../src/server/ticket-inbound";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const mail = (subject: string) => ({
  from: "rin@customer.example",
  fromName: "Rin",
  subject,
  text: "Hello",
  messageId: `<${randomBytes(6).toString("hex")}@customer.example>`,
});

describe("the public ticket desk", () => {
  let owner: Caller;
  let org: Awaited<ReturnType<World["org"]>>;
  let inbox: string;
  let ticketId: string;
  let ticketNumber: number;
  let portalToken: string;

  beforeAll(async () => {
    org = await world.org("Public desk");
    const o = await world.userIn(org, "owner", "Owner");

    owner = await world.caller(o.user, org);
    inbox = (await owner.tickets.setInbox({ enabled: true })).token!;

    await receiveTicketMail(db, inbox, mail("Printer broken"));

    const [row] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.organizationId, org.id));

    ticketId = row!.id;
    ticketNumber = row!.number;
    portalToken = randomBytes(32).toString("hex");
    await db
      .update(tickets)
      .set({ portalToken })
      .where(eq(tickets.id, ticketId));
  });

  it("stays closed while Tickets is off", async () => {
    await world.setModule(org, "tickets", false);

    try {
      expect(await receiveTicketMail(db, inbox, mail("Another"))).toEqual({
        status: "unknown",
      });
      expect(await portalView(db, portalToken)).toBeNull();
      expect(await portalReply(db, portalToken, "hi")).toEqual({ ok: false });
      expect(await publicArticles(db, org.slug)).toBeNull();
    } finally {
      await world.setModule(org, "tickets", true);
    }

    expect(await portalView(db, portalToken)).not.toBeNull();
  });

  it("stays closed while the organization is suspended", async () => {
    await db
      .update(organizations)
      .set({ suspendedAt: new Date() })
      .where(eq(organizations.id, org.id));
    forgetOrganizationStatus(org.id);

    try {
      expect(await receiveTicketMail(db, inbox, mail("While paused"))).toEqual({
        status: "unknown",
      });
      expect(await portalView(db, portalToken)).toBeNull();
    } finally {
      await db
        .update(organizations)
        .set({ suspendedAt: null })
        .where(eq(organizations.id, org.id));
      forgetOrganizationStatus(org.id);
    }
  });

  it("keeps a spam ticket closed when the sender writes again", async () => {
    await db
      .update(tickets)
      .set({ status: "spam" })
      .where(eq(tickets.id, ticketId));

    await receiveTicketMail(
      db,
      inbox,
      mail(`Re: [SUP-${ticketNumber}] hello?`),
    );
    await portalReply(db, portalToken, "Still there?");

    const [row] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    expect(row!.status).toBe("spam");
  });
});
