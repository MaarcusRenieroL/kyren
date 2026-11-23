import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { and, eq } from "@kyren/db/drizzle";
import { sprints, tickets, workLinks } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("assistant helpers and the custodian sweep", () => {
  let owner: Caller;
  let member: Caller;
  let org: Awaited<ReturnType<World["org"]>>;
  let hiddenSprintId: string;
  let hiddenDocSlug: string;
  let planDocId: string;

  beforeAll(async () => {
    org = await world.org("Assistant scope");
    const o = await world.userIn(org, "owner", "Priya");
    const m = await world.userIn(org, "member", "Arjun");

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);

    const open = await world.project(org, { taskKeyPrefix: "OPN" });
    const hidden = await world.project(org, {
      taskKeyPrefix: "SEC",
      visibility: "private",
    });

    await world.task(org, open, {
      taskNumber: 1,
      name: "Biometric login screen",
    });
    await world.task(org, hidden, {
      taskNumber: 1,
      name: "Biometric zero-knowledge vault",
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });
    await world.doc(org, {
      title: "Biometric public overview",
      projectId: open.id,
    });
    hiddenDocSlug = (
      await world.doc(org, {
        title: "Biometric secret architecture",
        projectId: hidden.id,
        content: "Ships with SEC-1.",
      })
    ).slug;
    planDocId = (
      await world.doc(org, {
        title: "Plan",
        projectId: open.id,
        content: "Before launch, finish OPN-1.",
      })
    ).id;

    hiddenSprintId = (
      await db
        .insert(sprints)
        .values({
          organizationId: org.id,
          projectId: hidden.id,
          name: "Secret sprint",
          startsOn: "2026-11-01",
          endsOn: "2026-11-14",
        })
        .returning()
    )[0]!.id;

    await db.insert(tickets).values({
      organizationId: org.id,
      number: 1,
      subject: "Biometric login fails on Chrome browser",
      description:
        "Signing in with the biometric prompt shows an error screen.",
      status: "open",
      requesterName: "Alice",
      requesterEmail: "alice@example.com",
    });
  });

  it("search only returns tasks and docs the caller can see", async () => {
    const ownerHits = await owner.ai.semanticSearch({ query: "biometric" });
    const memberHits = await member.ai.semanticSearch({ query: "biometric" });
    const titles = (hits: typeof ownerHits) => hits.map((hit) => hit.title);

    expect(titles(ownerHits)).toContain("Biometric zero-knowledge vault");
    expect(titles(ownerHits)).toContain("Biometric secret architecture");

    expect(titles(memberHits)).toContain("Biometric login screen");
    expect(titles(memberHits)).toContain("Biometric public overview");
    expect(titles(memberHits)).not.toContain("Biometric zero-knowledge vault");
    expect(titles(memberHits)).not.toContain("Biometric secret architecture");
  });

  it("search leaves out a module that is turned off", async () => {
    await world.setModule(org, "tickets", false);

    try {
      const hits = await owner.ai.semanticSearch({ query: "biometric" });

      expect(hits.some((hit) => hit.type === "ticket")).toBe(false);
      await expect(
        owner.ai.triageTicket({ subject: "Broken", body: "It is down" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await world.setModule(org, "tickets", true);
    }

    const hits = await owner.ai.semanticSearch({ query: "biometric" });

    expect(hits.some((hit) => hit.type === "ticket")).toBe(true);
  });

  it("search treats % and _ as text", async () => {
    const hits = await owner.ai.semanticSearch({ query: "%" });

    expect(hits).toEqual([]);
  });

  it("story points and triage still classify by keywords", async () => {
    expect(
      (await owner.ai.suggestStoryPoints({ title: "Fix typo in button copy" }))
        .points,
    ).toBe(1);
    expect(
      (
        await owner.ai.suggestStoryPoints({
          title:
            "Refactor architecture and engine for WebRTC concurrency protocol",
        })
      ).points,
    ).toBe(8);

    const urgent = await owner.ai.triageTicket({
      subject: "Critical security vulnerability and payment failing",
      body: "We are angry, our card billing is completely broken and down!",
    });

    expect(urgent).toMatchObject({
      priority: "urgent",
      sentiment: "frustrated",
      category: "billing",
    });
  });

  it("finds a duplicate of an open ticket", async () => {
    const result = await owner.ai.detectDuplicateTickets({
      subject: "Biometric login fails on Chrome",
      description: "Error screen appears with the biometric prompt",
    });

    expect(result.duplicates[0]?.ref).toBe("SUP-1");
  });

  it("a sprint or doc in a private project is not found for an outsider", async () => {
    await expect(
      member.ai.sprintBriefing({ sprintId: hiddenSprintId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      member.ai.generateLivingSpec({ docSlug: hiddenDocSlug }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const briefing = await owner.ai.sprintBriefing({
      sprintId: hiddenSprintId,
    });

    expect(briefing.sprintName).toBe("Secret sprint");
  });

  it("a member cannot run the custodian sweep", async () => {
    await expect(
      member.custodian.runSweep({ dryRun: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("the sweep rebuilds doc mention links and reports stale work", async () => {
    const result = await owner.custodian.runSweep({ dryRun: false });

    expect(result.linksCreated).toBeGreaterThanOrEqual(1);
    expect(result.staleTaskKeys).toContain("SEC-1");

    const links = await db
      .select({ id: workLinks.id, createdBy: workLinks.createdByMemberId })
      .from(workLinks)
      .where(
        and(eq(workLinks.sourceId, planDocId), eq(workLinks.kind, "mentions")),
      );

    expect(links).toHaveLength(1);
    expect(links[0]!.createdBy).not.toBeNull();

    const again = await owner.custodian.runSweep({ dryRun: false });

    expect(again.linksCreated).toBe(0);
  });
});

describe("assistant helpers refuse people without the underlying permission", () => {
  it("denies estimates without tasks.create and ticket helpers without tickets.view", async () => {
    const org = await world.org("Assistant denial");
    const m = await world.userIn(org, "member", "Limited");

    await world.override(org, m.user, "tasks.create", "deny");
    await world.override(org, m.user, "tickets.view", "deny");

    const limited = await world.caller(m.user, org);

    await expect(
      limited.ai.suggestStoryPoints({ title: "Fix typo" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      limited.ai.triageTicket({ subject: "Broken", body: "It is down" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      limited.ai.detectDuplicateTickets({ subject: "Login fails" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("a malformed sprint id", () => {
  it("is a validation error, not a server error", async () => {
    const org = await world.org("Sprint id shape");
    const o = await world.userIn(org, "owner", "Owner");
    const owner = await world.caller(o.user, org);

    await expect(
      owner.ai.sprintBriefing({ sprintId: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
