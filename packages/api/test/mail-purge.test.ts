import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("delete forever", () => {
  it("makes the message unreadable for whoever purged it, and only them", async () => {
    const org = await world.org("Mail purge");
    const a = await world.userIn(org, "owner", "Alice");
    const b = await world.userIn(org, "member", "Bob");
    const alice = await world.caller(a.user, org);
    const bob = await world.caller(b.user, org);

    const { id } = await alice.mail.send({
      to: [b.member.id],
      cc: [],
      subject: "Salary",
      body: "Confidential",
    });

    await bob.mail.update({ ids: [id], trashed: true });
    await bob.mail.purge({ ids: [id] });

    await expect(bob.mail.get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(alice.mail.get({ id })).resolves.toBeTruthy();

    await alice.mail.update({ ids: [id], trashed: true });
    await alice.mail.purge({ ids: [id] });

    await expect(alice.mail.get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
