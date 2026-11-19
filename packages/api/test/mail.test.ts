import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("mail", () => {
  let alice: Awaited<ReturnType<World["caller"]>>;
  let bob: Awaited<ReturnType<World["caller"]>>;
  let carol: Awaited<ReturnType<World["caller"]>>;
  let outsider: Awaited<ReturnType<World["caller"]>>;
  let bobMemberId: string;
  let carolMemberId: string;
  let sentId: string;

  beforeAll(async () => {
    const org = await world.org("Mail A");
    const other = await world.org("Mail B");
    const a = await world.userIn(org, "owner", "Alice");
    const b = await world.userIn(org, "member", "Bob");
    const c = await world.userIn(org, "member", "Carol");
    const o = await world.userIn(other, "owner", "Olga");

    alice = await world.caller(a.user, org);
    bob = await world.caller(b.user, org);
    carol = await world.caller(c.user, org);
    outsider = await world.caller(o.user, other);
    bobMemberId = b.member.id;
    carolMemberId = c.member.id;
  });

  it("delivers a sent message to its recipients only", async () => {
    ({ id: sentId } = await alice.mail.send({
      to: [bobMemberId],
      cc: [],
      subject: "Hello",
      body: "Private note",
    }));

    expect((await bob.mail.list({ folder: "inbox" })).items.length).toBe(1);
    expect((await carol.mail.list({ folder: "inbox" })).items.length).toBe(0);
    await expect(bob.mail.get({ id: sentId })).resolves.toBeTruthy();
    await expect(carol.mail.get({ id: sentId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(outsider.mail.get({ id: sentId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("keeps a draft private until it is sent", async () => {
    const { id } = await alice.mail.saveDraft({
      to: [carolMemberId],
      cc: [],
      subject: "Draft",
      body: "Not yet",
    });

    await expect(carol.mail.get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // Sending the same draft replaces its recipients in one step.
    await alice.mail.send({
      id,
      to: [bobMemberId],
      cc: [],
      subject: "Draft",
      body: "Now sent",
    });

    await expect(bob.mail.get({ id })).resolves.toBeTruthy();
    await expect(carol.mail.get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses recipients from another organization and empty sends", async () => {
    const stranger = (await outsider.mail.people())[0]!.id;

    await expect(
      alice.mail.send({ to: [stranger], cc: [], subject: "x", body: "y" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      alice.mail.send({ to: [bobMemberId], cc: [], subject: "", body: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      alice.mail.send({ to: [], cc: [], subject: "x", body: "y" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("never rewrites a message once it is sent, even by a late autosave", async () => {
    const { id } = await alice.mail.saveDraft({
      to: [bobMemberId],
      cc: [],
      subject: "Plan",
      body: "v1",
    });

    // An autosave and the send race; whichever loses must not win later.
    const [sent] = await Promise.allSettled([
      alice.mail.send({
        id,
        to: [bobMemberId],
        cc: [],
        subject: "Plan",
        body: "final",
      }),
      ...Array.from({ length: 5 }, () =>
        alice.mail.saveDraft({
          id,
          to: [carolMemberId],
          cc: [],
          subject: "Plan",
          body: "stale autosave",
        }),
      ),
    ]);

    // The send itself must go through, whatever the autosaves did.
    expect(sent.status).toBe("fulfilled");

    const delivered = await bob.mail.get({ id });

    expect(JSON.stringify(delivered)).toContain("final");
    expect(JSON.stringify(delivered)).not.toContain("stale autosave");
    await expect(carol.mail.get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // After the send, saving over it is refused outright.
    await expect(
      alice.mail.saveDraft({
        id,
        to: [bobMemberId],
        cc: [],
        subject: "Plan",
        body: "edited after sending",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Someone else's message id reads as missing, not as "sent".
    await expect(
      bob.mail.saveDraft({
        id,
        to: [carolMemberId],
        cc: [],
        subject: "x",
        body: "y",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
