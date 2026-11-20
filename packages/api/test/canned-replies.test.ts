import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("saved ticket replies", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let org: Awaited<ReturnType<World["org"]>>;
  let memberUser: Awaited<ReturnType<World["userIn"]>>["user"];

  beforeAll(async () => {
    org = await world.org("Saved replies");

    const o = await world.userIn(org, "owner", "Reply Owner");
    const m = await world.userIn(org, "member", "Reply Agent");
    const other = await world.org("Saved replies elsewhere");
    const x = await world.userIn(other, "owner", "Reply Outsider");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
    memberUser = m.user;
  });

  it("lets inbox managers write replies that every agent can use", async () => {
    const saved = await owner.cannedReply.save({
      title: "Refund on its way",
      body: "Hi {customer}, your refund for {ticket} is on its way. — {agent}",
    });

    expect((await member.cannedReply.list()).map((r) => r.id)).toContain(
      saved.id,
    );

    await owner.cannedReply.save({
      id: saved.id,
      title: "Refund sent",
      body: "Sent.",
    });
    expect(
      (await member.cannedReply.list()).find((r) => r.id === saved.id),
    ).toMatchObject({ title: "Refund sent", body: "Sent." });

    await owner.cannedReply.remove({ id: saved.id });
    expect((await member.cannedReply.list()).map((r) => r.id)).not.toContain(
      saved.id,
    );
  });

  it("refuses agents who don't manage the inbox", async () => {
    await expect(
      member.cannedReply.save({ title: "Mine", body: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const saved = await owner.cannedReply.save({ title: "Kept", body: "x" });

    await expect(
      member.cannedReply.remove({ id: saved.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps replies inside the organization", async () => {
    const saved = await owner.cannedReply.save({ title: "Ours", body: "x" });

    expect((await outsider.cannedReply.list()).map((r) => r.id)).not.toContain(
      saved.id,
    );
    await expect(
      outsider.cannedReply.save({ id: saved.id, title: "Hijack", body: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      outsider.cannedReply.remove({ id: saved.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("needs the right to reply to tickets to read them", async () => {
    await world.override(org, memberUser, "tickets.reply", "deny");

    const denied = await world.caller(memberUser, org);

    await expect(denied.cannedReply.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
