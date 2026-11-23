import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { db } from "@kyren/db";
import { and, eq } from "@kyren/db/drizzle";
import { activityEvents } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

const fetchMock = vi.fn(async (..._args: unknown[]) =>
  Response.json({ content: [{ type: "text", text: "- A short summary" }] }),
);

afterAll(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;

  return world.cleanup();
});

afterEach(() => fetchMock.mockClear());

describe("AI is off until an organization turns it on", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Awaited<ReturnType<World["caller"]>>;
  let member: Awaited<ReturnType<World["caller"]>>;
  let channelId: string;
  let ticketId: string;

  const events = (action: string) =>
    db
      .select()
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.organizationId, org.id),
          eq(activityEvents.action, action),
        ),
      );

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetchMock);

    org = await world.org("AI policy");
    const o = await world.userIn(org, "owner", "Ai Owner");
    const m = await world.userIn(org, "member", "Ai Member");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    channelId = (
      await owner.chat.create({ name: "ai", memberIds: [m.member.id] })
    ).id;
    await owner.chat.send({ channelId, body: "Ship the launch on Friday?" });
    ticketId = (
      await owner.tickets.create({
        subject: "Cannot log in",
        description: "Password reset email never arrives.",
        requesterName: "Rin",
      })
    ).id;
  });

  it("sends nothing to the model while the switch is off", async () => {
    expect(await owner.chat.aiStatus()).toEqual({ available: false });

    const { ai } = await owner.chat.summarize({ channelId });

    expect(ai).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(
      owner.tickets.summarize({ id: ticketId }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets only an admin change the switch, and records it", async () => {
    await expect(
      member.organization.setAiPolicy({ enabled: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await owner.organization.setAiPolicy({ enabled: true });

    const changed = await events("org.updated");

    expect(JSON.stringify(changed.map((e) => e.metadata))).toContain(
      "aiEnabled",
    );
  });

  it("uses the model once enabled and audits each use without the content", async () => {
    expect(await owner.chat.aiStatus()).toEqual({ available: true });

    const chat = await owner.chat.summarize({ channelId });

    expect(chat).toMatchObject({ ai: true, summary: "- A short summary" });

    const ticket = await owner.tickets.summarize({ id: ticketId });

    expect(ticket.summary).toBe("- A short summary");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The ticket text reaches the model, flagged as data.
    const sent = JSON.stringify(fetchMock.mock.calls[1]![1]);

    expect(sent).toContain("Password reset email never arrives.");

    const used = await events("ai.used");

    expect(used).toHaveLength(2);
    expect(JSON.stringify(used)).not.toContain("Password reset");
    expect(JSON.stringify(used)).not.toContain("launch on Friday");
  });

  it("turns off again straight away", async () => {
    await owner.organization.setAiPolicy({ enabled: false });

    const { ai } = await owner.chat.summarize({ channelId });

    expect(ai).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
