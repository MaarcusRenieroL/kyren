import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import {
  members,
  organizations,
  permissionOverrides,
  roleAssignments,
  sessions,
  teamMembers,
} from "@kyren/db/schema";
import { afterAll, describe, expect, it } from "vitest";

import { callAuth as call } from "./helpers/auth-call";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("leaving an organization", () => {
  it("is refused for the last owner", async () => {
    const org = await world.org("Last owner");
    const owner = await world.userIn(org, "owner");
    const response = await call(
      await world.sessionHeaders(owner.user, org),
      "POST",
      "/organization/leave",
      { organizationId: org.id },
    );

    expect(response.status).toBe(400);
    expect(
      await db.select().from(members).where(eq(members.organizationId, org.id)),
    ).toHaveLength(1);
    expect(
      await db.select().from(organizations).where(eq(organizations.id, org.id)),
    ).toHaveLength(1);
  });

  it("is allowed for a second owner", async () => {
    const org = await world.org("Two owners");

    await world.userIn(org, "owner");

    const second = await world.userIn(org, "owner");
    const response = await call(
      await world.sessionHeaders(second.user, org),
      "POST",
      "/organization/leave",
      { organizationId: org.id },
    );

    expect(response.status).toBe(200);
  });

  it("an organization the user is not in cannot be left", async () => {
    const org = await world.org("Not a member");
    const stranger = await world.user("Stranger");
    const response = await call(
      await world.sessionHeaders(stranger),
      "POST",
      "/organization/leave",
      { organizationId: org.id },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("clears the roles, overrides, team memberships and sessions that came with the membership", async () => {
    const org = await world.org("Leaving");
    await world.userIn(org, "owner");
    const leaver = await world.userIn(org, "member");
    const project = await world.project(org);
    const team = await world.team(org);

    await db.insert(teamMembers).values({
      organizationId: org.id,
      teamId: team.id,
      memberId: leaver.member.id,
    });
    await world.assign(
      org,
      await world.systemRoleId(org, "project_lead"),
      { type: "user", id: leaver.user.id },
      { type: "project", id: project.id },
    );
    await world.override(org, leaver.user, "tasks.view", "allow");

    const headers = await world.sessionHeaders(leaver.user, org);
    const response = await call(headers, "POST", "/organization/leave", {
      organizationId: org.id,
    });

    expect(response.status).toBe(200);
    expect(
      await db
        .select()
        .from(roleAssignments)
        .where(eq(roleAssignments.principalId, leaver.user.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(permissionOverrides)
        .where(eq(permissionOverrides.userId, leaver.user.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.memberId, leaver.member.id)),
    ).toHaveLength(0);

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, leaver.user.id));

    expect(session?.activeOrganizationId).toBeNull();

    const stale = await world.caller(leaver.user, org);

    await expect(stale.project.getProjectsByOrgId()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
