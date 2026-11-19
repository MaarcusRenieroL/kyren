import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import {
  accounts,
  employees,
  members,
  sessions,
  taskComments,
  tasks,
  users,
} from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("privacy: export and erase", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let other: Awaited<ReturnType<World["org"]>>;
  let owner: Caller;
  let admin: Caller;
  let ada: Caller;
  let bob: Caller;
  let outsider: Caller;
  let adaUser: Awaited<ReturnType<World["user"]>>;
  let adaMemberId: string;
  let bobMemberId: string;
  let project: Awaited<ReturnType<World["project"]>>;

  beforeAll(async () => {
    org = await world.org("Privacy");
    other = await world.org("Privacy elsewhere");

    const o = await world.userIn(org, "owner", "Priv Owner");
    const a = await world.userIn(org, "admin", "Priv Admin");
    const ad = await world.userIn(org, "member", "Ada Lovelace");
    const b = await world.userIn(org, "member", "Bob Builder");
    const x = await world.userIn(other, "owner", "Priv Outsider");
    project = await world.project(org, { taskKeyPrefix: "PV" });

    owner = await world.caller(o.user, org);
    admin = await world.caller(a.user, org);
    ada = await world.caller(ad.user, org);
    bob = await world.caller(b.user, org);
    outsider = await world.caller(x.user, other);
    adaUser = ad.user;
    adaMemberId = ad.member.id;
    bobMemberId = b.member.id;

    const adas = await world.task(org, project, {
      taskNumber: 1,
      name: "Ada's analytical engine",
      assignedToMemberId: ad.member.id,
      createdByMemberId: ad.member.id,
    });
    const bobs = await world.task(org, project, {
      taskNumber: 2,
      name: "Bob's secret plan",
      assignedToMemberId: b.member.id,
    });

    await db.insert(taskComments).values([
      {
        organizationId: org.id,
        taskId: adas.id,
        authorMemberId: ad.member.id,
        body: "Ada's own comment",
      },
      {
        organizationId: org.id,
        taskId: bobs.id,
        authorMemberId: b.member.id,
        body: "Bob's private comment",
      },
    ]);
    await db.insert(employees).values({
      organizationId: org.id,
      memberId: ad.member.id,
      name: "Ada Lovelace",
      email: "ada@company.example",
      jobTitle: "Engineer",
      location: "London",
    });
    await db.insert(sessions).values({
      expiresAt: new Date(Date.now() + 86_400_000),
      token: `tok-${ad.user.id}`,
      userId: ad.user.id,
    });
    await db.insert(accounts).values({
      accountId: ad.user.id,
      providerId: "credential",
      userId: ad.user.id,
      password: "hash-of-ada-password",
    });
  });

  it("exports a person's own data, and only theirs, without secrets", async () => {
    const data = await ada.privacy.exportMine();
    const text = JSON.stringify(data);

    expect(data.profile).toMatchObject({
      name: "Ada Lovelace",
      email: adaUser.email,
    });
    expect(data.tasks.map((t: { name: string }) => t.name)).toEqual([
      "Ada's analytical engine",
    ]);
    expect(data.comments.map((c: { body: string }) => c.body)).toEqual([
      "Ada's own comment",
    ]);
    expect(data.employee).toMatchObject({ location: "London" });
    expect(text).not.toContain("Bob");
    expect(text).not.toContain("hash-of-ada-password");
    expect(text).not.toContain(`tok-${adaUser.id}`);
  });

  it("lets only people who manage privacy export or erase someone else", async () => {
    await expect(
      ada.privacy.exportMember({ memberId: bobMemberId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      ada.privacy.erase({ memberId: bobMemberId, redactContent: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const data = await admin.privacy.exportMember({ memberId: bobMemberId });

    expect(data.profile.name).toBe("Bob Builder");
    await expect(
      outsider.privacy.exportMember({ memberId: bobMemberId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      outsider.privacy.erase({ memberId: bobMemberId, redactContent: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to erase the organisation's last owner", async () => {
    const ownerMember = (
      await db.select().from(members).where(eq(members.organizationId, org.id))
    ).find((m) => m.role === "owner")!;

    // Only an owner may erase an owner, so the last owner tries it on
    // themselves; an admin is turned away before that (erase-owner.test.ts).
    await expect(
      owner.privacy.erase({ memberId: ownerMember.id, redactContent: false }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Make someone else an owner first.",
    });
  });

  it("keeps the account of someone who belongs to another organisation too", async () => {
    const carol = await world.userIn(org, "member", "Carol Shared");

    await world.member(other, carol.user, "member");
    await admin.privacy.erase({
      memberId: carol.member.id,
      redactContent: false,
    });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, carol.user.id));

    expect(user!.name).toBe("Carol Shared");
    expect(
      await db.select().from(members).where(eq(members.id, carol.member.id)),
    ).toEqual([]);
    expect(
      (await db.select().from(members).where(eq(members.userId, carol.user.id)))
        .length,
    ).toBe(1);
  });

  it("erases a person: account anonymised, sign-ins gone, work kept without their name", async () => {
    await expect(
      ada.privacy.eraseMine({ confirmEmail: "wrong@example.test" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await admin.privacy.erase({ memberId: adaMemberId, redactContent: false });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, adaUser.id));

    expect(user!.name).toBe("Deleted user");
    expect(user!.email).toMatch(/^deleted-.+@deleted\.invalid$/);
    expect(user!.image).toBeNull();
    expect(
      await db.select().from(sessions).where(eq(sessions.userId, adaUser.id)),
    ).toEqual([]);
    expect(
      await db.select().from(accounts).where(eq(accounts.userId, adaUser.id)),
    ).toEqual([]);

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.name, "Ada's analytical engine"));

    expect(task).toMatchObject({
      assignedToMemberId: null,
      createdByMemberId: null,
    });

    const [comment] = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.body, "Ada's own comment"));

    expect(comment!.authorMemberId).toBeNull();

    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.organizationId, org.id));

    expect(employee).toMatchObject({
      name: "Former employee",
      email: null,
      location: null,
    });
  });

  it("can also redact what someone wrote when they are erased", async () => {
    const dan = await world.userIn(org, "member", "Dan Writer");
    const task = await world.task(org, project, {
      taskNumber: 3,
      name: "Dan's task",
    });

    await db.insert(taskComments).values({
      organizationId: org.id,
      taskId: task.id,
      authorMemberId: dan.member.id,
      body: "Dan said something personal",
    });
    await admin.privacy.erase({ memberId: dan.member.id, redactContent: true });

    const rows = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, task.id));

    expect(rows.map((r) => r.body)).toEqual(["[removed]"]);
    expect(JSON.stringify(rows)).not.toContain("personal");
  });
});
