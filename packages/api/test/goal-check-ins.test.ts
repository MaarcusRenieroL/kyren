import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("key result check-ins", () => {
  let owner: Caller;
  let resultOwner: Caller;
  let bystander: Caller;
  let outsider: Caller;
  let krId: string;
  let org: Awaited<ReturnType<World["org"]>>;
  let bystanderUser: Awaited<ReturnType<World["userIn"]>>["user"];

  beforeAll(async () => {
    org = await world.org("Check-ins");
    const o = await world.userIn(org, "owner", "Goal Lead");
    const r = await world.userIn(org, "member", "Metric Owner");
    const b = await world.userIn(org, "member", "Goal Bystander");
    const other = await world.org("Check-ins elsewhere");
    const x = await world.userIn(other, "owner", "Check Outsider");

    owner = await world.caller(o.user, org);
    resultOwner = await world.caller(r.user, org);
    bystander = await world.caller(b.user, org);
    bystanderUser = b.user;
    outsider = await world.caller(x.user, other);

    const objective = await owner.goals.saveObjective({
      title: "Win customers",
      status: "active",
    });
    const kr = await owner.goals.saveKeyResult({
      objectiveId: objective.id,
      title: "Paying customers",
      kind: "metric",
      startValue: 0,
      targetValue: 50,
      ownerMemberId: r.member.id,
    });

    krId = kr.id;
  });

  it("keeps every update with who made it, how confident they were and why", async () => {
    await resultOwner.goals.updateValue({
      keyResultId: krId,
      currentValue: 10,
      confidence: "on_track",
      note: "Two pilots signed",
    });
    await resultOwner.goals.updateValue({
      keyResultId: krId,
      currentValue: 12,
      confidence: "at_risk",
      note: "Sales hire slipped a month",
    });

    const history = await bystander.goals.checkIns({ keyResultId: krId });

    expect(history.map((c) => [c.value, c.confidence, c.note, c.by])).toEqual([
      [12, "at_risk", "Sales hire slipped a month", "Metric Owner"],
      [10, "on_track", "Two pilots signed", "Metric Owner"],
    ]);

    const [goal] = await bystander.goals.list();
    const kr = goal!.keyResults[0]!;

    expect(kr.currentValue).toBe(12);
    expect(kr.confidence).toBe("at_risk");
  });

  it("refuses updates from people who neither own the result nor manage goals", async () => {
    await expect(
      bystander.goals.updateValue({
        keyResultId: krId,
        currentValue: 49,
        confidence: "on_track",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (await owner.goals.checkIns({ keyResultId: krId })).map((c) => c.value),
    ).not.toContain(49);
  });

  it("keeps the history inside the organization", async () => {
    await expect(
      outsider.goals.checkIns({ keyResultId: krId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("needs the right to view tasks to read the history", async () => {
    await world.override(org, bystanderUser, "tasks.view", "deny");

    const denied = await world.caller(bystanderUser, org);

    await expect(
      denied.goals.checkIns({ keyResultId: krId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("starts with no confidence until someone checks in", async () => {
    const [goal] = await owner.goals.list();
    const fresh = await owner.goals.saveKeyResult({
      objectiveId: goal!.id,
      title: "Churn",
      kind: "metric",
      startValue: 10,
      targetValue: 2,
    });
    const [after] = await owner.goals.list();

    expect(
      after!.keyResults.find((kr) => kr.id === fresh.id)?.confidence,
    ).toBeNull();
  });
});
