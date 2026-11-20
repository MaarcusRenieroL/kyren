import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

/**
 * One organization must never reach another's data. Org A's owner creates
 * something in every module; org B's owner (who holds every permission in
 * their own organization, so a refusal can only come from organization
 * scoping) tries to read, change, delete and list it by id.
 *
 * Every probe first runs as org A's owner and must succeed there: that
 * proves the input is valid, so org B's refusal is about scope, not a typo.
 */
const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const refused = {
  code: expect.stringMatching(/NOT_FOUND|FORBIDDEN|BAD_REQUEST/),
};
const modules = [
  "projects",
  "tasks",
  "docs",
  "chat",
  "files",
  "calendar",
  "whiteboards",
  "mail",
  "tickets",
  "hr",
  "payroll",
];

describe("tenant isolation across every module", () => {
  let a: Caller;
  let b: Caller;
  let ids: Record<string, string>;
  let slugs: Record<string, string>;
  let bUserId: string;
  let bOrgId: string;

  beforeAll(async () => {
    const orgA = await world.org("Isolation A");
    const orgB = await world.org("Isolation B");

    for (const org of [orgA, orgB]) {
      for (const id of modules) await world.setModule(org, id, true);
    }

    const ownerA = await world.userIn(orgA, "owner", "Owner A");
    const colleague = await world.userIn(orgA, "member", "Colleague A");
    const ownerB = await world.userIn(orgB, "owner", "Owner B");

    a = await world.caller(ownerA.user, orgA);
    b = await world.caller(ownerB.user, orgB);
    bUserId = ownerB.user.id;
    bOrgId = orgB.id;

    const project = await a.project.createProject({
      name: "A secret project",
      slug: "a-secret-project",
      description: "",
    });
    const task = await a.task.createTask({
      projectId: project.id,
      name: "A secret task",
    });
    const doc = await a.docs.create({
      projectId: project.id,
      title: "A secret doc",
      slug: "a-secret-doc",
    });
    await a.docs.createComment({ docId: doc.id, body: "A secret comment" });

    const channel = await a.chat.create({
      name: "a-secret",
      memberIds: [colleague.member.id],
    });
    const message = await a.chat.send({
      channelId: channel.id,
      body: "A secret message",
    });
    const folder = await a.files.createFolder({ name: "A secret folder" });
    const file = await a.files.libraryRegister({
      name: "a-secret.pdf",
      mimeType: "application/pdf",
      size: 10,
      storageKey: `${orgA.id}/a-secret.pdf`,
    });
    const event = await a.calendar.create({
      title: "A secret event",
      description: null,
      location: null,
      color: "blue",
      allDay: false,
      startsAt: new Date("2031-01-06T09:00:00Z"),
      endsAt: new Date("2031-01-06T09:30:00Z"),
      repeat: null,
      repeatUntil: null,
    });
    const meeting = await a.meeting.create({
      title: "A secret meeting",
      startsAt: new Date(Date.now() + 86_400_000),
      durationMinutes: 30,
      attendeeUserIds: [],
    });
    const board = await a.whiteboard.create({ title: "A secret board" });
    const mail = await a.mail.send({
      to: [colleague.member.id],
      subject: "A secret mail",
      body: "x",
    });
    const ticket = await a.tickets.create({
      subject: "A secret ticket",
      description: "x",
      requesterName: "Rin",
    });
    const article = await a.kb.save({
      title: "A secret article",
      body: "x",
      status: "draft",
      audience: "internal",
    });
    const employee = await a.hr.create({
      name: "A secret employee",
      email: null,
      jobTitle: "Engineer",
      department: null,
      location: null,
      status: "active",
      startDate: null,
      endDate: null,
      managerId: null,
      memberId: null,
    });
    await a.payroll.setSalary({
      employeeId: employee.id,
      annualSalary: 6_000_000,
      currency: "USD",
    });

    const run = await a.payroll.createRun({
      label: "A secret run",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      deductionRateBps: 2000,
    });
    const webhook = await a.webhook.create({ url: "https://example.com/a" });
    const apiKey = await a.apiKey.create({ name: "A secret key" });
    const team = await a.team.create({ name: "A secret team" });
    const role = await a.permissions.roles.create({
      name: "A secret role",
      scope: "organization",
      permissions: [],
    });
    const reply = await a.cannedReply.save({
      title: "A secret reply",
      body: "x",
    });

    ids = {
      project: project.id,
      task: task.key,
      doc: doc.id,
      channel: channel.id,
      message: message.id,
      folder: folder.id,
      file: file.id,
      event: event.id,
      meeting: meeting.id,
      board: board.id,
      mail: mail.id,
      ticket: ticket.id,
      article: article.id,
      employee: employee.id,
      run: run.id,
      webhook: webhook.id,
      apiKey: apiKey.id,
      team: team.id,
      role: role.id,
      reply: reply.id,
    };
    slugs = { project: project.slug, doc: doc.slug };
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
