import { randomUUID } from "node:crypto";
import { createDatabaseAtMigration } from "@zentro/test-utils";

const beforeActivityMigration = 13;

export type BackfillIds = {
  org: string;
  otherOrg: string;
  owner: string;
  assignee: string;
  ownerMember: string;
  assigneeMember: string;
  project: string;
  team: string;
  task: string;
  comment: string;
  ev: string[];
  log: string[];
};

export type Row = Record<string, unknown>;

export async function setupBackfillDatabase(): Promise<{
  db: Awaited<ReturnType<typeof createDatabaseAtMigration>>;
  ids: BackfillIds;
}> {
  const ids: BackfillIds = {
    org: randomUUID(),
    otherOrg: randomUUID(),
    owner: randomUUID(),
    assignee: randomUUID(),
    ownerMember: randomUUID(),
    assigneeMember: randomUUID(),
    project: randomUUID(),
    team: randomUUID(),
    task: randomUUID(),
    comment: randomUUID(),
    ev: Array.from({ length: 6 }, () => randomUUID()),
    log: Array.from({ length: 6 }, () => randomUUID()),
  };

  const db = await createDatabaseAtMigration(
    "zentro_backfill_test",
    beforeActivityMigration,
  );

  for (const [id, name] of [
    [ids.owner, "Olive Owner"],
    [ids.assignee, "Sam Assignee"],
  ] as const) {
    await db.query(
      `insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`,
      [id, name, `${id}@example.test`],
    );
  }

  for (const [id, name] of [
    [ids.org, "Org"],
    [ids.otherOrg, "Other"],
  ] as const) {
    await db.query(
      `insert into organization (id, name, slug) values ($1, $2, $3)`,
      [id, name, `org-${id.slice(0, 8)}`],
    );
  }

  await db.query(
    `insert into member (id, "organizationId", "userId", role) values ($1,$2,$3,'owner'), ($4,$2,$5,'member')`,
    [ids.ownerMember, ids.org, ids.owner, ids.assigneeMember, ids.assignee],
  );
  await db.query(
    `insert into team (id, "organizationId", name) values ($1, $2, 'Squad')`,
    [ids.team, ids.org],
  );
  await db.query(
    `insert into project (id, "organizationId", name, slug, "taskKeyPrefix", "teamId")
       values ($1, $2, 'Atlas', 'atlas', 'AT', $3)`,
    [ids.project, ids.org, ids.team],
  );
  await db.query(
    `insert into task (id, "organizationId", "projectId", "teamId", key, "taskNumber", name)
       values ($1, $2, $3, $4, 'AT-1', 1, 'Plan')`,
    [ids.task, ids.org, ids.project, ids.team],
  );

  const at = (minutes: number) =>
    new Date(Date.UTC(2026, 0, 1, 12, minutes)).toISOString();
  const events: Array<
    [
      string,
      string,
      string | null,
      string | null,
      string | null,
      string | null,
      string,
    ]
  > = [
    [ids.ev[0]!, "task.created", null, null, null, null, at(0)],
    [
      ids.ev[1]!,
      "task.updated",
      "status",
      "todo",
      "in-progress",
      null,
      at(1),
    ],
    [ids.ev[2]!, "task.updated", "priority", "low", "high", null, at(2)],
    [
      ids.ev[3]!,
      "task.updated",
      "assignedToMemberId",
      null,
      ids.assigneeMember,
      null,
      at(3),
    ],
    [ids.ev[4]!, "comment.created", null, null, null, ids.comment, at(4)],
    [ids.ev[5]!, "task.deleted", null, null, null, null, at(5)],
  ];

  for (const [id, type, field, from, to, commentId, createdAt] of events) {
    await db.query(
      `insert into "taskActivityEvent" (id, "organizationId", "taskId", "actorMemberId", type, field, "fromValue", "toValue", "commentId", "createdAt")
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        ids.org,
        ids.task,
        ids.ownerMember,
        type,
        field,
        from,
        to,
        commentId,
        createdAt,
      ],
    );
  }

  const logs: Array<[string, string, string, string, unknown, unknown]> = [
    [
      ids.log[0]!,
      "role.created",
      "role",
      randomUUID(),
      null,
      { name: "Reviewer" },
    ],
    [
      ids.log[1]!,
      "override.created",
      "user",
      ids.assignee,
      null,
      { permission: "tasks.view" },
    ],
    [
      ids.log[2]!,
      "member.role.updated",
      "member",
      ids.assigneeMember,
      { role: "member" },
      { role: "admin" },
    ],
    [
      ids.log[3]!,
      "project.access.updated",
      "project",
      ids.project,
      { visibility: "organization" },
      { visibility: "private" },
    ],
    [
      ids.log[4]!,
      "assignment.created",
      "team",
      ids.team,
      null,
      { roleName: "Team lead" },
    ],
    [ids.log[5]!, "something.else", "role", "not-a-uuid", null, null],
  ];

  for (const [id, action, targetType, targetId, before, after] of logs) {
    await db.query(
      `insert into "permissionChangeLog" (id, "organizationId", "actorUserId", action, "targetType", "targetId", before, after, "createdAt")
         values ($1,$2,$3,$4,$5,$6,$7,$8,'2026-01-01T13:00:00Z')`,
      [
        id,
        ids.org,
        ids.owner,
        action,
        targetType,
        targetId,
        before === null ? null : JSON.stringify(before),
        after === null ? null : JSON.stringify(after),
      ],
    );
  }

  await db.query(
    `insert into role (id, "organizationId", name, scope, kind, "systemKey", permissions)
       values ($1,$2,'Admin','organization','system','admin','["members.view","tasks.view"]'),
              ($3,$2,'Member','organization','system','member','["tasks.view"]')`,
    [randomUUID(), ids.org, randomUUID()],
  );

  await db.migrateToLatest();

  return { db, ids };
}
