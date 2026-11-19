import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("a team lead adding people to their team", () => {
  let owner: Caller;
  let lead: Caller;
  let powerTeam: string;
  let plainTeam: string;
  let recruit: string;

  beforeAll(async () => {
    const org = await world.org("Lead escalation");
    const o = await world.userIn(org, "owner", "Owner");
    const l = await world.userIn(org, "member", "Lead");
    const r = await world.userIn(org, "member", "Recruit");

    owner = await world.caller(o.user, org);
    lead = await world.caller(l.user, org);
    recruit = r.member.id;
    powerTeam = (await world.team(org)).id;
    plainTeam = (await world.team(org)).id;

    const teamLead = await world.systemRoleId(org, "team_lead");

    for (const teamId of [powerTeam, plainTeam]) {
      await world.assign(
        org,
        teamLead,
        { type: "user", id: l.user.id },
        { type: "team", id: teamId },
      );
    }

    // The powerful team carries an organization-wide admin capability.
    const admins = await world.role(org, {
      name: "Key keepers",
      permissions: ["admin.manage_api_keys"],
    });

    await world.assign(
      org,
      admins.id,
      { type: "team", id: powerTeam },
      { type: "organization", id: org.id },
    );
  });

  it("cannot hand out a role they do not hold by adding someone", async () => {
    await expect(
      lead.team.updateMembers({ teamId: powerTeam, memberIds: [recruit] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("can still manage a team whose roles they hold", async () => {
    await expect(
      lead.team.updateMembers({ teamId: plainTeam, memberIds: [recruit] }),
    ).resolves.toBeDefined();
  });

  it("the owner can add to the powerful team", async () => {
    await expect(
      owner.team.updateMembers({ teamId: powerTeam, memberIds: [recruit] }),
    ).resolves.toBeDefined();
  });
});
