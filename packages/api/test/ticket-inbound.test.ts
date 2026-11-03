import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";

import { receiveTicketMail } from "../src/server/ticket-inbound";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const mail = (over: Partial<Parameters<typeof receiveTicketMail>[2]> = {}) => ({
  from: "rin@customer.example",
  fromName: "Rin Customer",
  subject: "Printer is broken",
  text: "It prints blank pages.",
  messageId: `<${Math.random().toString(36).slice(2)}@customer.example>`,
  ...over,
});

describe("email to ticket", () => {
  let owner: Caller;
  let member: Caller;
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    const org = await world.org("Inbound");
    const o = await world.userIn(org, "owner", "In Owner");
    const m = await world.userIn(org, "member", "In Member");
    const other = await world.org("Inbound elsewhere");
    const x = await world.userIn(other, "owner", "In Outsider");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);

    token = (await owner.tickets.setInbox({ enabled: true })).token!;
    otherToken = (
      await (
        await world.caller(x.user, other)
      ).tickets.setInbox({
        enabled: true,
      })
    ).token!;
  });

  it("lets only people who manage the inbox see or change it", async () => {
    await expect(member.tickets.inbox()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      member.tickets.setInbox({ enabled: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await owner.tickets.inbox()).enabled).toBe(true);
  });

  it("opens a ticket for a new email, with the sender as the requester", async () => {
    const result = await receiveTicketMail(db, token, mail());

    expect(result).toMatchObject({ status: "created", ref: "SUP-1" });

    const { tickets: rows } = await owner.tickets.list({ view: "open" });
    const ticket = rows.find((t) => t.subject === "Printer is broken")!;

    expect(ticket.requesterName).toBe("Rin Customer");

    const detail = await owner.tickets.get({ id: ticket.id });

    expect(detail.requesterEmail).toBe("rin@customer.example");
    expect(detail.description).toBe("It prints blank pages.");
  });

  it("adds a reply from the requester to the ticket and reopens it", async () => {
    const { tickets: rows } = await owner.tickets.list({ view: "open" });
    const ticket = rows.find((t) => t.subject === "Printer is broken")!;

    await owner.tickets.update({ id: ticket.id, status: "resolved" });

    const result = await receiveTicketMail(
      db,
      token,
      mail({ subject: "Re: Printer is broken [SUP-1]", text: "Still broken" }),
    );

    expect(result).toMatchObject({ status: "replied", ref: "SUP-1" });

    const detail = await owner.tickets.get({ id: ticket.id });

    expect(detail.status).toBe("open");
    expect(detail.resolvedAt).toBeNull();
    expect(detail.messages.at(-1)).toMatchObject({
      kind: "inbound",
      body: "Still broken",
      author: "Rin Customer",
    });
  });

  it("does not let a stranger write into someone else's ticket", async () => {
    const result = await receiveTicketMail(
      db,
      token,
      mail({
        from: "mallory@elsewhere.example",
        fromName: "Mallory",
        subject: "Re: [SUP-1] hi",
        text: "injected",
      }),
    );

    expect(result.status).toBe("created");
    expect(result.ref).not.toBe("SUP-1");
  });

  it("handles a repeated delivery once, and ignores automatic replies", async () => {
    const same = mail({ subject: "Once only" });

    expect((await receiveTicketMail(db, token, same)).status).toBe("created");
    expect((await receiveTicketMail(db, token, same)).status).toBe("duplicate");
    expect(
      (
        await receiveTicketMail(
          db,
          token,
          mail({ subject: "Out of office", autoSubmitted: "auto-replied" }),
        )
      ).status,
    ).toBe("ignored");
  });

  it("trims very long subjects and bodies", async () => {
    const result = await receiveTicketMail(
      db,
      token,
      mail({ subject: "S".repeat(500), text: "B".repeat(50_000) }),
    );

    expect(result.status).toBe("created");

    const { tickets: rows } = await owner.tickets.list({ view: "open" });
    const ticket = rows.find((t) => t.subject.startsWith("SSS"))!;

    expect(ticket.subject.length).toBe(200);
    expect(
      (await owner.tickets.get({ id: ticket.id })).description.length,
    ).toBe(10_000);
  });

  it("rejects unknown, rotated or switched-off addresses and keeps organisations apart", async () => {
    expect((await receiveTicketMail(db, "nope", mail())).status).toBe(
      "unknown",
    );

    // The other organisation's address creates tickets only in its own queue.
    await receiveTicketMail(
      db,
      otherToken,
      mail({ subject: "Elsewhere only" }),
    );
    expect(
      (await owner.tickets.list({ view: "open" })).tickets.some(
        (t) => t.subject === "Elsewhere only",
      ),
    ).toBe(false);

    const rotated = await owner.tickets.setInbox({
      enabled: true,
      rotate: true,
    });

    expect(rotated.token).not.toBe(token);
    expect((await receiveTicketMail(db, token, mail())).status).toBe("unknown");

    await owner.tickets.setInbox({ enabled: false });
    expect((await receiveTicketMail(db, rotated.token!, mail())).status).toBe(
      "unknown",
    );
  });
});
