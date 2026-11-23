import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  refused,
  setupTenantIsolationTest,
  type Caller,
} from "./helpers/tenant-isolation-fixture";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("tenant isolation across every module", () => {
  let a: Caller;
  let b: Caller;
  let ids: Record<string, string>;
  let slugs: Record<string, string>;
  let bUserId: string;
  let bOrgId: string;

  beforeAll(async () => {
    const fixture = await setupTenantIsolationTest(world);
    a = fixture.a;
    b = fixture.b;
    ids = fixture.ids;
    slugs = fixture.slugs;
    bUserId = fixture.bUserId;
    bOrgId = fixture.bOrgId;
  });

  /** Runs the probe as org A (must work), then as org B (must be refused). */
  const probe = async (call: (who: Caller) => Promise<unknown>) => {
    await expect(call(a)).resolves.toBeDefined();

    // Refused, or nothing at all: either way no data comes back.
    const outcome = await call(b).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );

    if ("error" in outcome) {
      expect(outcome.error).toMatchObject(refused);
    } else {
      const value = outcome.value;
      const empty =
        value == null || (Array.isArray(value) && value.length === 0);

      expect(empty, JSON.stringify(value)?.slice(0, 200)).toBe(true);
    }
  };

  it("refuses reading another organization's records by id or slug", async () => {
    await probe((c) => c.project.getProjectBySlug({ slug: slugs.project! }));
    await probe((c) => c.task.getTaskByKey({ key: ids.task! }));
    await probe((c) => c.docs.getById({ id: ids.doc! }));
    await probe((c) => c.docs.getBySlug({ slug: slugs.doc! }));
    await probe((c) => c.docs.getComments({ docId: ids.doc! }));
    await probe((c) => c.docs.getVersionHistory({ id: ids.doc! }));
    await probe((c) => c.chat.get({ id: ids.channel! }));
    await probe((c) => c.chat.messages({ channelId: ids.channel! }));
    await probe((c) => c.files.get({ id: ids.file! }));
    await probe((c) => c.meeting.get({ id: ids.meeting! }));
    await probe((c) => c.whiteboard.get({ id: ids.board! }));
    await probe((c) => c.whiteboard.version({ id: ids.board! }));
    await probe((c) => c.mail.get({ id: ids.mail! }));
    await probe((c) => c.tickets.get({ id: ids.ticket! }));
    await probe((c) => c.kb.revisions({ id: ids.article! }));
    await probe((c) => c.payroll.run({ id: ids.run! }));
    await probe((c) => c.webhook.deliveries({ id: ids.webhook! }));
    await probe((c) => c.team.getById({ id: ids.team! }));
    await probe((c) => c.permissions.roles.get({ id: ids.role! }));
  });

  it("refuses changing another organization's records", async () => {
    await expect(
      b.project.updateProjectBySlug({
        currentSlug: slugs.project!,
        slug: slugs.project!,
        name: "Taken",
      }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.task.updateTaskByKey({ key: ids.task!, name: "Taken" }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.docs.updateDocTitle({ id: ids.doc!, title: "Taken" }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.docs.setShare({ id: ids.doc!, enabled: true }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.chat.send({ channelId: ids.channel!, body: "Intruder" }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.chat.edit({ messageId: ids.message!, body: "Taken" }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.files.rename({ id: ids.file!, name: "taken.pdf" }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.files.renameFolder({ id: ids.folder!, name: "Taken" }),
    ).rejects.toMatchObject(refused);
    await expect(b.calendar.remove({ id: ids.event! })).rejects.toMatchObject(
      refused,
    );
    await expect(
      b.meeting.saveNotes({ id: ids.meeting!, notes: "Taken" }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.whiteboard.save({ id: ids.board!, elements: [] }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.tickets.update({ id: ids.ticket!, status: "resolved" }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.tickets.reply({ id: ids.ticket!, body: "Intruder", kind: "reply" }),
    ).rejects.toMatchObject(refused);
    await expect(b.kb.remove({ id: ids.article! })).rejects.toMatchObject(
      refused,
    );
    await expect(b.hr.remove({ id: ids.employee! })).rejects.toMatchObject(
      refused,
    );
    await expect(b.payroll.deleteRun({ id: ids.run! })).rejects.toMatchObject(
      refused,
    );
    await expect(b.webhook.remove({ id: ids.webhook! })).rejects.toMatchObject(
      refused,
    );
    await expect(b.apiKey.revoke({ id: ids.apiKey! })).rejects.toMatchObject(
      refused,
    );
    await expect(b.team.delete({ id: ids.team! })).rejects.toMatchObject(
      refused,
    );
    await expect(
      b.permissions.roles.delete({ id: ids.role! }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.cannedReply.remove({ id: ids.reply! }),
    ).rejects.toMatchObject(refused);
    await expect(
      b.permissions.assignments.assign({
        roleId: ids.role!,
        principalType: "user",
        principalId: bUserId,
        scopeType: "organization",
        scopeId: bOrgId,
      }),
    ).rejects.toMatchObject(refused);
  });

  it("never lists another organization's records", async () => {
    const seen = JSON.stringify(
      await Promise.all([
        b.project.getProjectsByOrgId(),
        b.task.getTasksByOrgId({}),
        b.docs.getAll({}),
        b.chat.sidebar(),
        b.chat.browse(),
        b.files.library({ kind: "all" }),
        b.files.folders(),
        b.calendar.list({
          from: new Date("2031-01-01T00:00:00Z"),
          to: new Date("2031-02-01T00:00:00Z"),
        }),
        b.meeting.list({ when: "upcoming" }),
        b.whiteboard.list(),
        b.mail.list({ folder: "inbox" }),
        b.tickets.list({}),
        b.kb.list({}),
        b.hr.directory(),
        b.payroll.runs(),
        b.webhook.list(),
        b.apiKey.list(),
        b.team.getAll(),
        b.permissions.roles.list(),
        b.cannedReply.list(),
        b.search.query({ query: "secret" }),
        b.audit.list({}),
      ]),
    );

    for (const [kind, id] of Object.entries(ids)) {
      expect(seen, `${kind} leaked into another organization`).not.toContain(
        id,
      );
    }

    expect(seen).not.toContain("A secret");
  });
});
