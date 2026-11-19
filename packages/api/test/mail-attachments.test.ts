import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("mail attachments", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let ana: Caller;
  let ben: Caller;
  let cy: Caller;
  let benId: string;
  let cyUser: Awaited<ReturnType<World["userIn"]>>["user"];

  const upload = (
    who: Caller,
    name: string,
    kind: "mail" | "library" = "mail",
  ) =>
    (kind === "mail" ? who.files.mailRegister : who.files.libraryRegister)({
      name,
      mimeType: "application/pdf",
      size: 10,
      storageKey: `${org.id}/${name}-${Math.random().toString(36).slice(2)}`,
    });

  beforeAll(async () => {
    org = await world.org("Mail files");
    const a = await world.userIn(org, "owner", "Ana Mail");
    const b = await world.userIn(org, "member", "Ben Mail");
    const c = await world.userIn(org, "member", "Cy Mail");

    cyUser = c.user;
    ana = await world.caller(a.user, org);
    ben = await world.caller(b.user, org);
    cy = await world.caller(c.user, org);
    benId = b.member.id;
  });

  it("reaches the people the message is sent to, and nobody else", async () => {
    const file = await upload(ana, "quote.pdf");
    const { id } = await ana.mail.saveDraft({
      to: [benId],
      subject: "Quote",
      body: "Attached.",
      fileIds: [file.id],
    });

    // A draft's attachment stays with its writer.
    await expect(ben.files.get({ id: file.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await ana.mail.send({
      id,
      to: [benId],
      subject: "Quote",
      body: "Attached.",
      fileIds: [file.id],
    });

    const thread = await ben.mail.get({ id });

    expect(thread.messages[0]!.attachments).toEqual([
      expect.objectContaining({ id: file.id, name: "quote.pdf" }),
    ]);
    await expect(ben.files.get({ id: file.id })).resolves.toMatchObject({
      name: "quote.pdf",
    });
    await expect(cy.files.get({ id: file.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // It never shows in Files, not even the sender's.
    for (const who of [ana, cy]) {
      expect(
        (await who.files.library({ kind: "all" })).map((f) => f.name),
      ).not.toContain("quote.pdf");
    }

    // Once sent, the sender can't take it back or change it from Files.
    await expect(ana.files.remove({ id: file.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      ana.files.rename({ id: file.id, name: "other.pdf" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ben.files.get({ id: file.id })).resolves.toMatchObject({
      name: "quote.pdf",
    });
  });

  it("takes only the sender's own mail uploads", async () => {
    const bens = await upload(ben, "bens.pdf");
    const library = await upload(ana, "shared.pdf", "library");

    await expect(
      ana.mail.send({
        to: [benId],
        subject: "Not mine",
        body: "x",
        fileIds: [bens.id],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      ana.mail.send({
        to: [benId],
        subject: "Library file",
        body: "x",
        fileIds: [library.id],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("needs the right to send mail to upload an attachment", async () => {
    await world.override(org, cyUser, "mail.send", "deny");

    const denied = await world.caller(cyUser, org);

    await expect(upload(denied, "blocked.pdf")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      denied.files.mailAuthorize({ size: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
