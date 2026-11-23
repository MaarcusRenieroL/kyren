import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";

import { publicForm, submitIntake } from "../src/server/intake-forms";
import { setTicketMailer } from "../src/server/ticket-mail";
import { World } from "./helpers";

const world = new World();

afterAll(async () => {
  setTicketMailer(null);
  await world.cleanup();
});

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("intake forms", () => {
  let owner: Caller;
  let member: Caller;
  let other: Caller;
  let token: string;
  let formId: string;
  let otherToken: string;

  const fields = [
    { label: "Your name", type: "name" as const, required: true },
    { label: "Your email", type: "email" as const, required: true },
    { label: "Topic", type: "text" as const, required: true },
    {
      label: "Product",
      type: "choice" as const,
      required: false,
      options: ["Web", "Mobile"],
    },
    { label: "Details", type: "longtext" as const, required: false },
  ];

  beforeAll(async () => {
    // No real mail from tests; acknowledgements are checked in their own test.
    setTicketMailer(async () => undefined);
    const org = await world.org("Intake");
    const o = await world.userIn(org, "owner", "In Owner");
    const m = await world.userIn(org, "member", "In Member");
    const elsewhere = await world.org("Intake elsewhere");
    const x = await world.userIn(elsewhere, "owner", "In Outsider");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    other = await world.caller(x.user, elsewhere);

    const created = await owner.intake.save({
      name: "Report a problem",
      description: "Tell us what is wrong.",
      enabled: true,
      fields,
    });

    formId = created.id;
    token = created.token;

    otherToken = (
      await other.intake.save({
        name: "Elsewhere form",
        description: "",
        enabled: true,
        fields: [{ label: "Topic", type: "text", required: true }],
      })
    ).token;
  });

  it("lets only people who manage forms create or list them", async () => {
    await expect(member.intake.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      member.intake.save({
        name: "x",
        description: "",
        enabled: true,
        fields: [{ label: "A", type: "text", required: false }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await owner.intake.list()).map((f) => f.name)).toEqual([
      "Report a problem",
    ]);
  });

  it("checks the form itself: a name, a few fields, choices that have options", async () => {
    const base = { description: "", enabled: true };

    await expect(
      owner.intake.save({ ...base, name: "", fields }),
    ).rejects.toBeDefined();
    await expect(
      owner.intake.save({ ...base, name: "Empty", fields: [] }),
    ).rejects.toBeDefined();
    await expect(
      owner.intake.save({
        ...base,
        name: "Bad choice",
        fields: [{ label: "Pick", type: "choice", required: true }],
      }),
    ).rejects.toBeDefined();
    await expect(
      owner.intake.save({
        ...base,
        name: "Too many",
        fields: Array.from({ length: 21 }, (_, i) => ({
          label: `F${i}`,
          type: "text" as const,
          required: false,
        })),
      }),
    ).rejects.toBeDefined();
  });

  it("shows the public only what it needs to fill the form in", async () => {
    const form = await publicForm(db, token);

    expect(form).toMatchObject({
      name: "Report a problem",
      description: "Tell us what is wrong.",
    });
    expect(form!.fields.map((f) => f.label)).toEqual(
      fields.map((f) => f.label),
    );
    expect(Object.keys(form!).sort()).toEqual(
      ["description", "fields", "name"].sort(),
    );
    expect(await publicForm(db, "f".repeat(48))).toBeNull();
    expect(await publicForm(db, "short")).toBeNull();
  });

  it("turns a submission into a ticket in that organisation's queue", async () => {
    const form = await publicForm(db, token);
    const id = (label: string) =>
      form!.fields.find((f) => f.label === label)!.id;

    const result = await submitIntake(db, token, {
      [id("Your name")]: "Rin Customer",
      [id("Your email")]: "Rin@Customer.example",
      [id("Topic")]: "Cannot log in",
      [id("Product")]: "Web",
      [id("Details")]: "The reset email never arrives.",
      "not-a-field": "ignored",
    });

    expect(result).toMatchObject({
      ok: true,
      ref: expect.stringMatching(/^SUP-\d+$/),
    });

    const { tickets } = await owner.tickets.list({ view: "open" });
    const ticket = tickets.find((t) => t.subject.includes("Cannot log in"))!;

    expect(ticket.requesterName).toBe("Rin Customer");

    const detail = await owner.tickets.get({ id: ticket.id });

    expect(detail.requesterEmail).toBe("rin@customer.example");
    expect(detail.description).toContain("Product: Web");
    expect(detail.description).toContain("The reset email never arrives.");
    expect(detail.description).not.toContain("ignored");
    expect(
      (await other.tickets.list({ view: "open" })).tickets.some((t) =>
        t.subject.includes("Cannot log in"),
      ),
    ).toBe(false);
  });

  it("refuses a submission with missing, malformed or out-of-list answers", async () => {
    const form = await publicForm(db, token);
    const id = (label: string) =>
      form!.fields.find((f) => f.label === label)!.id;

    const missing = await submitIntake(db, token, { [id("Your name")]: "Rin" });

    expect(missing.ok).toBe(false);

    const badEmail = await submitIntake(db, token, {
      [id("Your name")]: "Rin",
      [id("Your email")]: "not an email",
      [id("Topic")]: "x",
    });

    expect(badEmail.ok).toBe(false);

    const badChoice = await submitIntake(db, token, {
      [id("Your name")]: "Rin",
      [id("Your email")]: "rin@customer.example",
      [id("Topic")]: "x",
      [id("Product")]: "Fax machine",
    });

    expect(badChoice.ok).toBe(false);
  });

  it("trims very long answers", async () => {
    const form = await publicForm(db, token);
    const id = (label: string) =>
      form!.fields.find((f) => f.label === label)!.id;

    await submitIntake(db, token, {
      [id("Your name")]: "N".repeat(500),
      [id("Your email")]: "long@customer.example",
      [id("Topic")]: "Long one " + "T".repeat(500),
      [id("Details")]: "D".repeat(50_000),
    });

    const { tickets } = await owner.tickets.list({ view: "open" });
    const ticket = tickets.find((t) => t.subject.includes("Long one"))!;

    expect(ticket.subject.length).toBeLessThanOrEqual(200);
    expect(ticket.requesterName.length).toBeLessThanOrEqual(120);
    expect(
      (await owner.tickets.get({ id: ticket.id })).description.length,
    ).toBeLessThanOrEqual(10_000);
  });

  it("stops accepting answers once a form is switched off, and keeps organisations apart", async () => {
    const form = await publicForm(db, otherToken);

    expect(form!.name).toBe("Elsewhere form");

    await owner.intake.save({
      id: formId,
      name: "Report a problem",
      description: "",
      enabled: false,
      fields,
    });
    expect(await publicForm(db, token)).toBeNull();
    expect((await submitIntake(db, token, {})).ok).toBe(false);

    await owner.intake.remove({ id: formId });
    await expect(owner.intake.remove({ id: formId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await other.intake.list()).length).toBe(1);
  });
});
