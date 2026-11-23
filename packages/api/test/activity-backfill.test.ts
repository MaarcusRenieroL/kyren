import { beforeAll, describe, expect, it } from "vitest";

import {
  setupBackfillDatabase,
  type BackfillIds,
  type Row,
} from "./helpers/activity-backfill-fixture";

describe("activity event backfill", () => {
  let db: Awaited<ReturnType<typeof setupBackfillDatabase>>["db"];
  let ids: BackfillIds;

  beforeAll(async () => {
    const fixture = await setupBackfillDatabase();
    db = fixture.db;
    ids = fixture.ids;
  });

  const events = () =>
    db.query<Row>(
      `select * from "activityEvent" where "organizationId" = $1 order by "createdAt", id`,
      [ids.org],
    );

  it("copies every task activity and permission log row", async () => {
    expect(await events()).toHaveLength(12);
  });

  it("keeps ids, timestamps and the old tables", async () => {
    const copied = await events();

    for (const id of [...ids.ev, ...ids.log]) {
      expect(
        copied.some((row) => row.id === id),
        id,
      ).toBe(true);
    }

    // Timestamps are copied as they were, compared inside the database.
    expect(
      await db.query(
        `select 1 from "activityEvent" a join "taskActivityEvent" t on t.id = a.id
           where a."createdAt" = t."createdAt"`,
      ),
    ).toHaveLength(6);
    expect(
      await db.query(
        `select 1 from "activityEvent" a join "permissionChangeLog" l on l.id = a.id
           where a."createdAt" = l."createdAt"`,
      ),
    ).toHaveLength(6);
    expect(await db.query(`select 1 from "taskActivityEvent"`)).toHaveLength(6);
    expect(await db.query(`select 1 from "permissionChangeLog"`)).toHaveLength(
      6,
    );
  });

  it("maps task events to action keys, labels, project and team", async () => {
    const byId = Object.fromEntries(
      (await events()).map((row) => [row.id as string, row]),
    );

    expect(byId[ids.ev[0]!]).toMatchObject({
      action: "task.created",
      targetType: "task",
      targetId: ids.task,
      targetLabel: "AT-1",
      projectId: ids.project,
      teamId: ids.team,
      actorUserId: ids.owner,
      auditOnly: false,
    });
    expect(byId[ids.ev[1]!]).toMatchObject({ action: "task.status_changed" });
    expect(byId[ids.ev[1]!]!.metadata).toMatchObject({
      changes: [{ field: "status", from: "todo", to: "in-progress" }],
    });
    expect(byId[ids.ev[2]!]).toMatchObject({ action: "task.updated" });
    expect(byId[ids.ev[3]!]).toMatchObject({ action: "task.assigned" });
    expect(byId[ids.ev[3]!]!.metadata).toMatchObject({
      changes: [{ field: "assignee", from: null, to: "Sam Assignee" }],
    });
    expect(byId[ids.ev[4]!]).toMatchObject({ action: "task.comment_added" });
    expect(byId[ids.ev[4]!]!.metadata).toMatchObject({
      commentId: ids.comment,
    });
    expect(byId[ids.ev[5]!]).toMatchObject({ action: "task.deleted" });
  });

  it("maps permission log rows, keeping before and after", async () => {
    const byId = Object.fromEntries(
      (await events()).map((row) => [row.id as string, row]),
    );

    expect(byId[ids.log[0]!]).toMatchObject({
      action: "role.created",
      auditOnly: true,
      targetLabel: "Reviewer",
    });
    expect(byId[ids.log[1]!]).toMatchObject({ action: "override.set" });
    expect(byId[ids.log[2]!]).toMatchObject({ action: "member.role_updated" });
    expect(byId[ids.log[2]!]!.metadata).toMatchObject({
      before: { role: "member" },
      after: { role: "admin" },
    });
    expect(byId[ids.log[3]!]).toMatchObject({
      action: "project.visibility_changed",
      projectId: ids.project,
    });
    expect(byId[ids.log[4]!]).toMatchObject({
      action: "assignment.created",
      teamId: ids.team,
      targetLabel: "Team lead",
    });
    expect(byId[ids.log[5]!]).toMatchObject({
      action: "something.else",
      projectId: null,
    });
  });

  it("marks the old default keys as applied on system roles", async () => {
    const [admin] = await db.query<{
      appliedDefaults: string[];
      permissions: string[];
    }>(
      `select "appliedDefaults", permissions from role where "systemKey" = 'admin'`,
    );

    // Not the keys the role had in this fixture, but the defaults of the time:
    // a key the administrator removed must not come back.
    expect(admin!.appliedDefaults).toContain("roles.view");
    expect(admin!.appliedDefaults).not.toContain("audit_logs.view");
    expect(admin!.permissions).toEqual(["members.view", "tasks.view"]);
  });

  it("is idempotent when the copy statements run again", async () => {
    const before = (await events()).length;

    await db.query(`
      INSERT INTO "activityEvent" ("id", "organizationId", "actorUserId", "action", "targetType", "targetId", "auditOnly", "metadata", "createdAt")
      SELECT l."id", l."organizationId", l."actorUserId", l."action", l."targetType", l."targetId", true, '{}'::jsonb, l."createdAt"
      FROM "permissionChangeLog" l
      ON CONFLICT ("id") DO NOTHING`);
    expect(await events()).toHaveLength(before);
  });
});
