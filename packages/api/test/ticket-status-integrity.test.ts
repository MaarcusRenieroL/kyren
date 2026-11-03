import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("ticket status changes", () => {
  let agent: Awaited<ReturnType<World["caller"]>>;

  beforeAll(async () => {
    const org = await world.org("Ticket status");
    const o = await world.userIn(org, "owner", "Status Owner");

    agent = await world.caller(o.user, org);
  });

  async function newTicket(subject: string) {
    return agent.tickets.create({
      subject,
      description: "",
      requesterName: "Rita",
      requesterEmail: null,
      priority: "normal",
      category: null,
      assigneeMemberId: null,
    });
  }

  it("keeps the first resolution time when a resolved ticket is saved again", async () => {
    const { id } = await newTicket("Resolve twice");

    await agent.tickets.update({ id, status: "resolved" });
    const first = (await agent.tickets.get({ id })).resolvedAt;

    await new Promise((resolve) => setTimeout(resolve, 20));
    await agent.tickets.update({ id, status: "resolved", priority: "high" });

    expect((await agent.tickets.get({ id })).resolvedAt).toEqual(first);
  });

  it("parks an open ticket on reply but leaves a resolved one alone", async () => {
    const open = await newTicket("Open then reply");
    const done = await newTicket("Resolved then reply");

    await agent.tickets.update({ id: done.id, status: "resolved" });
    await agent.tickets.reply({ id: open.id, kind: "reply", body: "Hi" });
    await agent.tickets.reply({ id: done.id, kind: "reply", body: "Hi" });

    expect((await agent.tickets.get({ id: open.id })).status).toBe("pending");
    expect((await agent.tickets.get({ id: done.id })).status).toBe("resolved");
  });
});
