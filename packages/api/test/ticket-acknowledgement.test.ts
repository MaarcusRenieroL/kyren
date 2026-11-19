import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";

import { publicForm, submitIntake } from "../src/server/intake-forms";
import { receiveTicketMail } from "../src/server/ticket-inbound";
import { setTicketMailer, type TicketMail } from "../src/server/ticket-mail";
import { World } from "./helpers";

const world = new World();
const sent: TicketMail[] = [];

afterAll(async () => {
  setTicketMailer(null);
  await world.cleanup();
});

// Fresh addresses each run: the per-address limit is stored in the database.
const run = Math.random().toString(36).slice(2, 8);
const kim = `kim-${run}@customer.example`;
const lee = `lee-${run}@customer.example`;

const mail = (over: Partial<Parameters<typeof receiveTicketMail>[2]> = {}) => ({
  from: kim,
  fromName: "Kim Customer",
  subject: "Invoice is wrong",
  text: "The total is off by 10.",
  messageId: `<${Math.random().toString(36).slice(2)}@customer.example>`,
  ...over,
});

describe("acknowledging a new request", () => {
  let token: string;
  let formToken: string;

  beforeAll(async () => {
    const org = await world.org("Ack Co");
    const o = await world.userIn(org, "owner", "Ack Owner");
    const owner = await world.caller(o.user, org);

    token = (await owner.tickets.setInbox({ enabled: true })).token!;
    formToken = (
      await owner.intake.save({
        name: "Billing question",
        description: "",
        enabled: true,
        fields: [
          { label: "Your name", type: "name", required: true },
          { label: "Your email", type: "email", required: true },
          { label: "Question", type: "text", required: true },
        ],
      })
    ).token;
    setTicketMailer(async (message) => {
      sent.push(message);
    });
  });

  it("tells the sender their request arrived, once, as automatic mail", async () => {
    sent.length = 0;

    const result = await receiveTicketMail(db, token, mail());

    expect(result.status).toBe("created");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: kim,
      autoSubmitted: "auto-replied",
    });
    expect(sent[0]!.subject).toContain(result.ref!);
    // Nothing the sender wrote is repeated back.
    expect(sent[0]!.subject).not.toContain("Invoice");
    expect(sent[0]!.path).toMatch(/^\/support\/.+/);

    // A follow-up on the same ticket is a reply, not a new request.
    sent.length = 0;
    await receiveTicketMail(
      db,
      token,
      mail({ subject: `Re: Invoice is wrong [${result.ref}]` }),
    );
    expect(sent).toHaveLength(0);
  });

  it("stays quiet for automatic mail, so two autoresponders can't loop", async () => {
    sent.length = 0;

    const result = await receiveTicketMail(
      db,
      token,
      mail({ autoSubmitted: "auto-replied" }),
    );

    expect(result.status).toBe("ignored");
    expect(sent).toHaveLength(0);
  });

  it("acknowledges a form submission too", async () => {
    sent.length = 0;

    const form = await publicForm(db, formToken);
    const id = (label: string) =>
      form!.fields.find((field) => field.label === label)!.id;
    const result = await submitIntake(db, formToken, {
      [id("Your name")]: "Lee",
      [id("Your email")]: lee,
      [id("Question")]: "Why was I charged twice?",
    });

    expect(result.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: lee,
      autoSubmitted: "auto-generated",
    });
  });

  it("doesn't answer mailing lists, and caps how often one address hears back", async () => {
    sent.length = 0;

    await receiveTicketMail(db, token, mail({ precedence: "list" }));
    expect(sent).toHaveLength(0);

    const target = `victim-${Math.random().toString(36).slice(2)}@customer.example`;

    for (let index = 0; index < 5; index += 1) {
      await receiveTicketMail(
        db,
        token,
        mail({ from: target, subject: `Spam ${index}` }),
      );
    }

    expect(sent.filter((message) => message.to === target)).toHaveLength(3);
  });
});
