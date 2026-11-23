import { db } from "@kyren/db";
import { and, eq } from "@kyren/db/drizzle";
import { activityEvents, members, tickets } from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { receiveTicketMail } from "../src/server/ticket-inbound";
import { setTicketMailer } from "../src/server/ticket-mail";
import { World } from "./helpers";

const world = new World();

afterAll(async () => {
  setTicketMailer(null);
  await world.cleanup();
});

type Caller = Awaited<ReturnType<World["caller"]>>;

let sequence = 0;
const mail = () => {
  sequence += 1;

  return {
    from: `asker-${sequence}-${Math.random().toString(36).slice(2, 7)}@customer.example`,
    fromName: "Asker",
    subject: `Question ${sequence}`,
    text: "Please help.",
    messageId: `<${Math.random().toString(36).slice(2)}@customer.example>`,
  };
};

describe("automatic ticket assignment", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Caller;
  let member: Caller;
  let token: string;
  let ada: string;
  let ben: string;
  let cy: string;

  const assigneeOf = async (ref: string | undefined) => {
    const [row] = await db
      .select({ assignee: tickets.assigneeMemberId })
      .from(tickets)
      .where(
        and(
          eq(tickets.organizationId, org.id),
          eq(tickets.number, Number(ref!.replace("SUP-", ""))),
        ),
      );

    return row!.assignee;
  };
  const arrive = async () =>
    assigneeOf((await receiveTicketMail(db, token, mail())).ref);

  beforeAll(async () => {
    setTicketMailer(async () => undefined);
    org = await world.org("Assign Co");
    const o = await world.userIn(org, "owner", "Owner");
    const m = await world.userIn(org, "member", "Member");

    ada = (await world.userIn(org, "member", "Ada")).member.id;
    ben = (await world.userIn(org, "member", "Ben")).member.id;
    cy = (await world.userIn(org, "member", "Cy")).member.id;
    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    token = (await owner.tickets.setInbox({ enabled: true })).token!;
  });

  it("leaves new tickets unassigned until it is turned on", async () => {
    expect(await arrive()).toBeNull();
  });

  it("takes turns, skipping whoever is away or has left", async () => {
    await owner.tickets.setAssignmentRule({
      enabled: true,
      memberIds: [ada, ben, cy],
    });

    expect(await arrive()).toBe(ada);
    expect(await arrive()).toBe(ben);
    expect(await arrive()).toBe(cy);
    expect(await arrive()).toBe(ada);

    // Ben goes out of office; Cy leaves the organization.
    await db.insert(activityEvents).values({
      organizationId: org.id,
      action: "member.out_of_office",
      targetType: "member",
      targetId: ben,
      metadata: { isOutOfOffice: true, untilDate: null },
    });
    await db.delete(members).where(eq(members.id, cy));

    expect(await arrive()).toBe(ada);
    expect(await arrive()).toBe(ada);

    // Cy has left, but saving the list the admin last saw still works,
    // and drops him.
    await expect(
      owner.tickets.setAssignmentRule({
        enabled: false,
        memberIds: [ada, ben, cy],
      }),
    ).resolves.toEqual({
      enabled: false,
      memberIds: [ada, ben],
      mode: "round_robin",
    });
    expect(await arrive()).toBeNull();
  });

  it("is set only by people who run the desk, with people from this organization", async () => {
    await expect(
      member.tickets.setAssignmentRule({ enabled: true, memberIds: [ada] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(member.tickets.assignmentRule()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const outsider = (
      await world.userIn(await world.org("Elsewhere"), "member", "Out")
    ).member.id;

    await expect(
      owner.tickets.setAssignmentRule({ enabled: true, memberIds: [outsider] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.tickets.setAssignmentRule({ enabled: true, memberIds: [] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(owner.tickets.assignmentRule()).resolves.toMatchObject({
      enabled: false,
    });
  });

  it("skips people who can no longer see tickets", async () => {
    const dee = await world.userIn(org, "member", "Dee");

    await world.override(org, dee.user, "tickets.view", "deny");
    await owner.tickets.setAssignmentRule({
      enabled: true,
      memberIds: [dee.member.id, ada],
    });

    expect(await arrive()).toBe(ada);
    expect(await arrive()).toBe(ada);
  });
});

describe("assigning to whoever has the fewest open tickets", () => {
  it("picks the lightest load, counts only open and pending tickets, and breaks ties by turn", async () => {
    setTicketMailer(async () => undefined);
    const org = await world.org("Least open Co");
    const o = await world.userIn(org, "owner", "Desk Owner");
    const owner = await world.caller(o.user, org);
    const ada = (await world.userIn(org, "member", "Ada L")).member.id;
    const ben = (await world.userIn(org, "member", "Ben L")).member.id;
    const cy = (await world.userIn(org, "member", "Cy L")).member.id;
    const token = (await owner.tickets.setInbox({ enabled: true })).token!;
    const arrive = async () => {
      const { ref } = await receiveTicketMail(db, token, mail());
      const [row] = await db
        .select({ id: tickets.id, assignee: tickets.assigneeMemberId })
        .from(tickets)
        .where(
          and(
            eq(tickets.organizationId, org.id),
            eq(tickets.number, Number(ref!.replace("SUP-", ""))),
          ),
        );

      return row!;
    };
    const give = async (memberId: string, status = "open") => {
      const { id } = await arrive();

      await db
        .update(tickets)
        .set({ assigneeMemberId: memberId, status })
        .where(eq(tickets.id, id));
    };

    // Ada carries two open tickets, Cy one, Ben none; Ben's resolved one
    // doesn't count.
    await give(ada);
    await give(ada, "pending");
    await give(cy);
    await give(ben, "resolved");

    const rule = await owner.tickets.setAssignmentRule({
      enabled: true,
      memberIds: [ada, ben, cy],
      mode: "least_open",
    });

    expect(rule.mode).toBe("least_open");
    expect((await owner.tickets.assignmentRule()).mode).toBe("least_open");
    expect((await arrive()).assignee).toBe(ben);
    // Ben and Cy now hold one each; Cy comes after Ben in turn.
    expect((await arrive()).assignee).toBe(cy);
    expect((await arrive()).assignee).toBe(ben);

    // Saving the rotation without naming a mode keeps the one in use.
    await owner.tickets.setAssignmentRule({
      enabled: true,
      memberIds: [ada, ben, cy],
    });
    expect((await owner.tickets.assignmentRule()).mode).toBe("least_open");
  });
});
