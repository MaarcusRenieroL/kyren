import { db } from "@zentro/db";
import { afterAll, describe, expect, it } from "vitest";

import {
  addToTeam,
  forbidden,
  setMemberRole,
} from "./helpers/scoped-access-helpers";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("team leads manage their own team", () => {
  async function build() {
    const org = await world.org("Team leads");
    const owner = await world.userIn(org, "owner", "Odin Owner");
    const lead = await world.userIn(org, "member", "Lena Lead");
    const mate = await world.userIn(org, "member", "Milo Mate");
    const boss = await world.userIn(org, "admin", "Bea Boss");
    const stranger = await world.userIn(org, "member", "Sam Stranger");
    const team = await world.team(org, { name: "Alpha" });
    const otherTeam = await world.team(org, { name: "Beta" });

    await setMemberRole(world, org, ["members.view", "teams.view"]);

    for (const person of [lead, mate, boss]) {
      await addToTeam(org, team.id, person.member);
    }

    await addToTeam(org, otherTeam.id, stranger.member);
    await addToTeam(org, otherTeam.id, lead.member);

    const teamLead = await world.systemRoleId(org, "team_lead");

    await world.assign(
      org,
      teamLead,
      { type: "user", id: lead.user.id },
      { type: "team", id: team.id },
    );

    return {
      org,
      owner,
      lead,
      mate,
      boss,
      stranger,
      team,
      otherTeam,
      teamMemberRole: await world.systemRoleId(org, "team_member"),
      teamLead,
    };
  }

  it("has no organization-wide role access", async () => {
    const { org, lead } = await build();
    const as = await world.caller(lead.user, org);
    const me = await as.permissions.me();

    expect(me.permissions["roles.view"]).toBe(false);
    expect(me.permissions["roles.assign"]).toBe(false);
    await expect(as.permissions.roles.list()).rejects.toMatchObject(forbidden);
    await expect(as.permissions.assignments.list()).rejects.toMatchObject(
      forbidden,
    );
  });

  it("views the roles on their own team", async () => {
    const { org, lead, team, mate, teamMemberRole } = await build();

    await world.assign(
      org,
      teamMemberRole,
      { type: "user", id: mate.user.id },
      { type: "team", id: team.id },
    );

    const panel = await (
      await world.caller(lead.user, org)
    ).permissions.assignments.listForTeam({ teamId: team.id });

    expect(panel.teamRoles.map((role) => role.name)).toEqual(
      expect.arrayContaining(["Team lead", "Team member"]),
    );
    expect(panel.assignments.map((row) => row.principalName).sort()).toEqual(
      ["Lena Lead", "Milo Mate"].sort(),
    );
  });

  it("cannot view the roles of a team they do not lead", async () => {
    const { org, lead, otherTeam } = await build();
    const as = await world.caller(lead.user, org);

    await expect(
      as.permissions.assignments.listForTeam({ teamId: otherTeam.id }),
    ).rejects.toMatchObject(forbidden);
  });

  it("assigns and removes team roles for the team's members", async () => {
    const { org, lead, mate, team, teamMemberRole } = await build();
    const as = await world.caller(lead.user, org);
    const assignment = await as.permissions.assignments.assign({
      roleId: teamMemberRole,
      principalType: "user",
      principalId: mate.user.id,
      scopeType: "team",
      scopeId: team.id,
    });

    expect(assignment.scopeId).toBe(team.id);
    await expect(
      as.permissions.assignments.unassign({ assignmentId: assignment.id }),
    ).resolves.toEqual({ id: assignment.id });
  });

  it("cannot assign to people outside the team or in another team", async () => {
    const { org, lead, stranger, team, otherTeam, teamMemberRole } =
      await build();
    const as = await world.caller(lead.user, org);

    await expect(
      as.permissions.assignments.assign({
        roleId: teamMemberRole,
        principalType: "user",
        principalId: stranger.user.id,
        scopeType: "team",
        scopeId: team.id,
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      as.permissions.assignments.assign({
        roleId: teamMemberRole,
        principalType: "user",
        principalId: stranger.user.id,
        scopeType: "team",
        scopeId: otherTeam.id,
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("cannot grant what they do not hold", async () => {
    const { org, lead, mate, team } = await build();
    const powerful = await world.role(org, {
      name: "Team task admin",
      scope: "team",
      permissions: ["teams.view", "tasks.view", "tasks.delete_any"],
    });

    await expect(
      (await world.caller(lead.user, org)).permissions.assignments.assign({
        roleId: powerful.id,
        principalType: "user",
        principalId: mate.user.id,
        scopeType: "team",
        scopeId: team.id,
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("cannot edit themselves, an owner or an admin above them", async () => {
    const { org, owner, lead, boss, team, teamMemberRole } = await build();
    const as = await world.caller(lead.user, org);

    await addToTeam(org, team.id, owner.member);

    for (const target of [lead, owner, boss]) {
      await expect(
        as.permissions.assignments.assign({
          roleId: teamMemberRole,
          principalType: "user",
          principalId: target.user.id,
          scopeType: "team",
          scopeId: team.id,
        }),
      ).rejects.toMatchObject(forbidden);
    }
  });

  it("cannot remove an admin's or their own team role", async () => {
    const { org, lead, boss, team, teamMemberRole, teamLead } = await build();
    const adminRole = await world.assign(
      org,
      teamMemberRole,
      { type: "user", id: boss.user.id },
      { type: "team", id: team.id },
    );
    const own = (
      await db.query.roleAssignments.findMany({
        where: (table, { and, eq }) =>
          and(eq(table.principalId, lead.user.id), eq(table.roleId, teamLead)),
      })
    )[0]!;
    const as = await world.caller(lead.user, org);

    await expect(
      as.permissions.assignments.unassign({ assignmentId: adminRole.id }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      as.permissions.assignments.unassign({ assignmentId: own.id }),
    ).rejects.toMatchObject(forbidden);
  });

  it("cannot assign organization or project roles", async () => {
    const { org, lead, mate, team } = await build();
    const project = await world.project(org);
    const orgRole = await world.role(org, {
      name: "Org reader",
      permissions: ["teams.view"],
    });
    const as = await world.caller(lead.user, org);
    const projectRole = await world.systemRoleId(org, "project_viewer");

    await expect(
      as.permissions.assignments.assign({
        roleId: orgRole.id,
        principalType: "team",
        principalId: team.id,
        scopeType: "organization",
        scopeId: org.id,
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      as.permissions.assignments.assign({
        roleId: projectRole,
        principalType: "user",
        principalId: mate.user.id,
        scopeType: "project",
        scopeId: project.id,
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("manages the members of their own team only", async () => {
    const { org, lead, mate, stranger, team, otherTeam } = await build();
    const as = await world.caller(lead.user, org);

    await expect(
      as.team.updateMembers({
        teamId: team.id,
        memberIds: [lead.member.id, mate.member.id, stranger.member.id],
      }),
    ).resolves.toMatchObject({ memberIds: expect.any(Array) });
    await expect(
      as.team.updateMembers({ teamId: otherTeam.id, memberIds: [] }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      as.team.update({ id: team.id, name: "Renamed", color: "slate" }),
    ).rejects.toMatchObject(forbidden);
    await expect(as.team.delete({ id: team.id })).rejects.toMatchObject(
      forbidden,
    );
  });

  it("a plain member of the team can do none of this", async () => {
    const { org, mate, team, lead, teamMemberRole } = await build();
    const as = await world.caller(mate.user, org);

    await expect(
      as.permissions.assignments.listForTeam({ teamId: team.id }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      as.permissions.assignments.assign({
        roleId: teamMemberRole,
        principalType: "user",
        principalId: lead.user.id,
        scopeType: "team",
        scopeId: team.id,
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("an admin can still assign to anyone on any team", async () => {
    const { org, boss, stranger, otherTeam, teamMemberRole } = await build();

    await expect(
      (await world.caller(boss.user, org)).permissions.assignments.assign({
        roleId: teamMemberRole,
        principalType: "user",
        principalId: stranger.user.id,
        scopeType: "team",
        scopeId: otherTeam.id,
      }),
    ).resolves.toMatchObject({ scopeId: otherTeam.id });
  });
});
