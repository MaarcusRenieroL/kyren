import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { members, projects } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World, type TestOrg, type TestUser } from "./helpers";
import {
  type Caller,
  expectAllowed,
  forbidden,
  randomId,
} from "./helpers/permission-helpers";

const world = new World();
afterAll(() => world.cleanup());

describe("default roles reproduce today's behavior", () => {
  let org: TestOrg;
  let owner: Caller;
  let admin: Caller;
  let member: Caller;
  let projectSlug: string;
  let teamId: string;
  let adminUser: TestUser;
  let memberUser: TestUser;

  beforeAll(async () => {
    org = await world.org("Defaults");
    const o = await world.userIn(org, "owner", "Owen Owner");
    const a = await world.userIn(org, "admin", "Ada Admin");
    const m = await world.userIn(org, "member", "Max Member");

    adminUser = a.user;
    memberUser = m.user;
    owner = await world.caller(o.user, org);
    admin = await world.caller(a.user, org);
    member = await world.caller(m.user, org);

    const project = await world.project(org, { taskKeyPrefix: "DF" });
    projectSlug = project.slug;
    teamId = (await world.team(org)).id;
    await world.task(org, project, { taskNumber: 1, name: "Seed task" });
  });

  it("lets a member do everyday work", async () => {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, projectSlug));
    const projectId = project[0]!.id;

    const task = await member.task.createTask({ projectId, name: "By member" });
    await expectAllowed(
      member.task.updateTaskByKey({ key: task.key, status: "in-progress" }),
    );
    // Any task, not only their own.
    await expectAllowed(
      member.task.updateTaskByKey({ key: "DF-1", priority: "high" }),
    );
    await expectAllowed(member.task.deleteTaskByKey({ key: "DF-1" }));
    await expectAllowed(
      member.comment.createTaskComment({ taskKey: task.key, body: "hi" }),
    );
    await expectAllowed(
      member.activity.getTaskActivityEvents({ taskKey: task.key }),
    );

    const doc = await member.docs.create({ title: "Doc", slug: "member-doc" });
    await expectAllowed(
      member.docs.updateDocTitle({ id: doc.id, title: "New" }),
    );
    await expectAllowed(
      member.docs.createComment({ docId: doc.id, body: "c" }),
    );
    await expectAllowed(member.docs.delete({ id: doc.id }));
    await expectAllowed(member.docs.restore({ id: doc.id }));

    await expectAllowed(member.project.getProjectsByOrgId());
    await expectAllowed(member.project.getProjectBySlug({ slug: projectSlug }));
    await expectAllowed(member.team.getAll());
    await expectAllowed(member.member.getMembers());
    await expectAllowed(member.modules.list());
    await expectAllowed(member.task.getOverview());
    await expectAllowed(member.docs.search({ query: "x" }));
  });

  it("keeps administrative actions away from members", async () => {
    await expect(
      member.project.createProject({
        name: "No",
        slug: "no-project",
        description: "",
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      member.project.updateProjectBySlug({
        currentSlug: projectSlug,
        name: "Renamed",
        slug: projectSlug,
        description: "",
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      member.project.archiveProject({ slug: projectSlug }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      member.project.deleteProject({ slug: projectSlug }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      member.team.create({ name: "Nope team", color: "slate" }),
    ).rejects.toMatchObject(forbidden);
    await expect(member.team.delete({ id: teamId })).rejects.toMatchObject(
      forbidden,
    );
    await expect(
      member.team.updateMembers({ teamId, memberIds: [] }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      member.modules.setEnabled({ moduleId: "docs", enabled: false }),
    ).rejects.toMatchObject(forbidden);
    await expect(member.invitation.list()).rejects.toMatchObject(forbidden);
    await expect(
      member.invitation.invite({
        email: `x.${crypto.randomUUID()}@example.test`,
        role: "member",
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      member.organization.update({ name: "Hijacked" }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      member.member.updateRole({ memberId: randomId(), role: "admin" }),
    ).rejects.toMatchObject(forbidden);
    await expect(member.permissions.roles.list()).rejects.toMatchObject(
      forbidden,
    );
    await expect(member.permissions.log.list()).rejects.toMatchObject(
      forbidden,
    );
  });

  it("lets an admin do everything except owner-only actions", async () => {
    await expectAllowed(
      admin.project.createProject({
        name: "By admin",
        slug: "by-admin",
        description: "",
      }),
    );
    await expectAllowed(
      admin.team.create({ name: "Admin team", color: "slate" }),
    );
    await expectAllowed(
      admin.modules.setEnabled({ moduleId: "docs", enabled: true }),
    );
    await expectAllowed(admin.invitation.list());
    await expectAllowed(admin.permissions.roles.list());
    await expectAllowed(admin.permissions.log.list());
    await expectAllowed(admin.organization.update({ name: "Defaults" }));

    await expect(admin.organization.delete()).rejects.toMatchObject(forbidden);
    await expect(
      admin.member.transferOwnership({ memberId: randomId() }),
    ).rejects.toMatchObject(forbidden);
  });

  it("lets the owner do owner-only actions", async () => {
    const [target] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.organizationId, org.id),
          eq(members.userId, adminUser.id),
        ),
      );

    await expect(
      owner.member.transferOwnership({ memberId: target!.id }),
    ).resolves.toBeDefined();

    const [former] = await db
      .select()
      .from(members)
      .where(
        and(eq(members.organizationId, org.id), eq(members.role, "admin")),
      );

    expect(former).toBeDefined();

    // Hand it back so later tests keep their fixtures.
    await db
      .update(members)
      .set({ role: "admin" })
      .where(eq(members.userId, adminUser.id));
    await db
      .update(members)
      .set({ role: "owner" })
      .where(
        and(
          eq(members.organizationId, org.id),
          eq(members.role, "admin"),
          eq(members.userId, memberUser.id),
        ),
      );
  });
});
