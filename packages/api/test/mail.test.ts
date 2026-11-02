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

    expect((await bob.mail.list({ folder: "inbox" })).length).toBe(1);
    expect((await carol.mail.list({ folder: "inbox" })).length).toBe(0);
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
});
