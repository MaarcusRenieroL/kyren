import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@kyren/db";

import { portalReply, portalView } from "../src/server/ticket-portal";
import { setTicketMailer, type TicketMail } from "../src/server/ticket-mail";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("customer portal", () => {
  let owner: Caller;
  let ticketId: string;
  let token: string;
  let otherToken: string;
  let sent: TicketMail[] = [];

  beforeAll(async () => {
    const org = await world.org("Portal");
    const o = await world.userIn(org, "owner", "Portal Owner");
    const other = await world.org("Portal elsewhere");
    const x = await world.userIn(other, "owner", "Portal Outsider");
    const outsider = await world.caller(x.user, other);

    owner = await world.caller(o.user, org);
    setTicketMailer(async () => undefined);

    ticketId = (
      await owner.tickets.create({
        subject: "Cannot log in",
        description: "Password reset fails",
        requesterName: "Rin",
        requesterEmail: "rin@customer.example",
      })
    ).id;
    token = (await owner.tickets.get({ id: ticketId })).portalToken;

    const theirs = await outsider.tickets.create({
      subject: "Theirs",
      requesterName: "Zed",
      requesterEmail: "zed@customer.example",
    });

    otherToken = (await outsider.tickets.get({ id: theirs.id })).portalToken;
  });

  beforeEach(() => {
    sent = [];
    setTicketMailer(async (mail) => {
      sent.push(mail);
    });
  });

  afterAll(() => setTicketMailer(null));

  it("gives every ticket a long private link and no two the same", () => {
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(otherToken).not.toBe(token);
  });

  it("shows the requester their ticket and the replies, never internal notes or team details", async () => {
    await owner.tickets.reply({ id: ticketId, body: "Try the new link" });
    await owner.tickets.reply({
      id: ticketId,
      kind: "note",
      body: "Customer is rude, escalate",
    });

    const view = await portalView(db, token);

    expect(view).not.toBeNull();
    expect(view!.subject).toBe("Cannot log in");
    expect(view!.ref).toMatch(/^SUP-\d+$/);
    expect(view!.messages.map((m) => m.body)).toEqual([
      "Password reset fails",
      "Try the new link",
    ]);
    expect(JSON.stringify(view)).not.toContain("escalate");
    expect(Object.keys(view!).sort()).toEqual(
      ["messages", "ref", "status", "subject"].sort(),
    );
    expect(await portalView(db, "f".repeat(64))).toBeNull();
    expect(await portalView(db, "short")).toBeNull();
  });

  it("lets the requester reply, which reopens the ticket", async () => {
    await owner.tickets.update({ id: ticketId, status: "resolved" });

    const result = await portalReply(db, token, "  It works now, thanks  ");

    expect(result).toEqual({ ok: true });

    const detail = await owner.tickets.get({ id: ticketId });

    expect(detail.status).toBe("open");
    expect(detail.messages.at(-1)).toMatchObject({
      kind: "inbound",
      body: "It works now, thanks",
      author: "Rin",
    });
  });

  it("refuses empty or oversized replies and unknown links", async () => {
    expect(await portalReply(db, token, "   ")).toEqual({ ok: false });
    expect(await portalReply(db, "f".repeat(64), "hello")).toEqual({
      ok: false,
    });

    await portalReply(db, token, "x".repeat(50_000));

    const last = (await owner.tickets.get({ id: ticketId })).messages.at(-1)!;

    expect(last.body.length).toBe(10_000);
  });

  it("keeps one organisation's links away from another's tickets", async () => {
    const view = await portalView(db, otherToken);

    expect(view!.subject).toBe("Theirs");
    expect(JSON.stringify(view)).not.toContain("Cannot log in");
  });

  it("emails the requester an agent's reply, with the link and the reference, but not notes", async () => {
    await owner.tickets.reply({ id: ticketId, body: "We fixed it" });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: "rin@customer.example",
      body: "We fixed it",
      path: `/support/${token}`,
    });
    expect(sent[0]!.subject).toMatch(/^Re: Cannot log in \[SUP-\d+\]$/);

    sent = [];
    await owner.tickets.reply({ id: ticketId, kind: "note", body: "internal" });
    expect(sent).toEqual([]);
  });

  it("sends nothing when the ticket has no email address, and survives a failing mailer", async () => {
    const bare = await owner.tickets.create({
      subject: "Phone call",
      requesterName: "Sam",
    });

    sent = [];
    await owner.tickets.reply({ id: bare.id, body: "Called back" });
    expect(sent).toEqual([]);

    setTicketMailer(async () => {
      throw new Error("mail is down");
    });
    await expect(
      owner.tickets.reply({ id: ticketId, body: "Still saved" }),
    ).resolves.toBeDefined();
  });
});
