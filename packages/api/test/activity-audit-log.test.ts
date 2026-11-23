import { db } from "@kyren/db";
import { eq, sql } from "@kyren/db/drizzle";
import { activityEvents } from "@kyren/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { maxExportRows } from "../src/server/routers/audit";
import { World, type TestOrg, type TestUser } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const forbidden = { code: "FORBIDDEN" };

describe("tenant isolation of activity", () => {
  it("never shows another organization's events", async () => {
    const orgA = await world.org("Iso A");
    const orgB = await world.org("Iso B");
    const a = await world.userIn(orgA, "owner", "Ann");
    const b = await world.userIn(orgB, "owner", "Bea");
    const asA = await world.caller(a.user, orgA);
    const asB = await world.caller(b.user, orgB);

    await asB.project.createProject({
      name: "B only",
      slug: "b-only",
      description: "",
    });

    expect((await asA.activity.list({ scope: "organization" })).items).toEqual(
      [],
    );
    expect(
      (await asA.audit.list({})).items.some((e) => e.targetLabel === "B only"),
    ).toBe(false);
    expect(
      (await asB.audit.list({})).items.some((e) => e.targetLabel === "B only"),
    ).toBe(true);
  });
});

describe("the audit log", () => {
  let org: TestOrg;
  let owner: Caller;
  let admin: Caller;
  let member: Caller;
  let ownerUser: TestUser;
  let projectId: string;

  beforeAll(async () => {
    org = await world.org("Audit");
    const o = await world.userIn(org, "owner", "Olive Owner");
    const a = await world.userIn(org, "admin", "Ada Admin");
    const m = await world.userIn(org, "member", "Max Member");

    ownerUser = o.user;
    owner = await world.caller(o.user, org);
    admin = await world.caller(a.user, org);
    member = await world.caller(m.user, org);

    const project = await owner.project.createProject({
      name: '=Danger,"quoted"',
      slug: "danger",
      description: "",
    });

    projectId = project.id;
    await owner.task.createTask({ projectId, name: "T" });
    await owner.permissions.roles.create({
      name: "Auditor",
      scope: "organization",
      permissions: ["tasks.view"],
    });
  });

  it("is for people who hold audit_logs.view: owner and admin, not members", async () => {
    expect((await owner.audit.list({})).items.length).toBeGreaterThan(0);
    expect((await admin.audit.list({})).items.length).toBeGreaterThan(0);
    await expect(member.audit.list({})).rejects.toMatchObject(forbidden);
    await expect(member.audit.export({})).rejects.toMatchObject(forbidden);
  });

  it("includes audit-only events and request details", async () => {
    const items = (await owner.audit.list({})).items;

    expect(items.some((event) => event.action === "role.created")).toBe(true);
    expect(items.every((event) => "ip" in event && "requestId" in event)).toBe(
      true,
    );
  });

  it("filters by actor, action, target, project, dates and text", async () => {
    const byActor = await owner.audit.list({ actorUserId: ownerUser.id });
    const none = await owner.audit.list({
      actorUserId: "00000000-0000-4000-8000-000000000000",
    });

    expect(byActor.items.length).toBeGreaterThan(0);
    expect(none.items).toEqual([]);
    expect(
      (await owner.audit.list({ actionPrefix: "task." })).items.every((e) =>
        e.action.startsWith("task."),
      ),
    ).toBe(true);
    expect(
      (await owner.audit.list({ targetType: "role" })).items.every(
        (e) => e.targetType === "role",
      ),
    ).toBe(true);
    expect(
      (await owner.audit.list({ projectId })).items.every(
        (e) => e.projectId === projectId,
      ),
    ).toBe(true);
    expect(
      (await owner.audit.list({ from: new Date(Date.now() + 60_000) })).items,
    ).toEqual([]);
    expect(
      (await owner.audit.list({ to: new Date(Date.now() + 60_000) })).items
        .length,
    ).toBeGreaterThan(0);
    expect(
      (await owner.audit.list({ search: "Auditor" })).items.map(
        (e) => e.action,
      ),
    ).toContain("role.created");
    expect((await owner.audit.list({ search: "%" })).items).toEqual([]);
  });

  it("exports the current filter as CSV without secrets and records the export", async () => {
    const result = await owner.audit.export({ search: "danger" });

    expect(result.rowCount).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
    expect(result.filename).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/);

    const [header, ...rows] = result.csv.split("\r\n");

    expect(header).toBe(
      "time,actor,action,event,description,target_type,target_id,target,project_id,team_id,audit_only,ip,user_agent,request_id",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(result.csv).toContain(`"'=Danger,""quoted"""`);
    expect(result.csv).not.toMatch(/metadata/i);

    const exported = (await owner.audit.list({ actionPrefix: "audit." })).items;

    expect(exported[0]!.metadata).toMatchObject({
      filter: { search: "danger" },
    });
  });

  it("pages stably through events with identical timestamps", async () => {
    const paging = await world.org("Paging");
    const p = await world.userIn(paging, "owner");
    const as = await world.caller(p.user, paging);
    const at = new Date("2026-02-01T10:00:00.000Z");

    await db.insert(activityEvents).values(
      Array.from({ length: 9 }, (_, index) => ({
        organizationId: paging.id,
        action: "task.created",
        targetType: "task",
        targetId: `t-${index}`,
        createdAt: at,
      })),
    );

    const seen: string[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 20; page += 1) {
      const result = await as.audit.list({ limit: 2, cursor });

      seen.push(...result.items.map((item) => item.id));

      if (!result.nextCursor) {
        break;
      }

      cursor = result.nextCursor;
    }

    expect(seen).toHaveLength(9);
    expect(new Set(seen).size).toBe(9);
    expect(seen).toEqual([...seen].sort().reverse());
  });

  it("caps the export at the maximum", async () => {
    const big = await world.org("Big");
    const p = await world.userIn(big, "owner");
    const as = await world.caller(p.user, big);

    await db.execute(sql`
      insert into "activityEvent" ("organizationId", "action", "targetType", "targetId", "createdAt")
      select ${big.id}::uuid, 'task.created', 'task', 't' || g, now() - (g || ' seconds')::interval
      from generate_series(1, ${maxExportRows + 1}) g`);

    const result = await as.audit.export({});

    expect(result.rowCount).toBe(maxExportRows);
    expect(result.truncated).toBe(true);
    expect(result.csv.split("\r\n")).toHaveLength(maxExportRows + 1);
    expect(
      (
        await db
          .select()
          .from(activityEvents)
          .where(eq(activityEvents.organizationId, big.id))
      ).length,
    ).toBeGreaterThan(maxExportRows);
  }, 120_000);
});
