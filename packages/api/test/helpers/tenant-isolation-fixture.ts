import { expect } from "vitest";
import { type World } from "./world";

export type Caller = Awaited<ReturnType<World["caller"]>>;

export const refused = {
  code: expect.stringMatching(/NOT_FOUND|FORBIDDEN|BAD_REQUEST/),
};

export const modules = [
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

export async function setupTenantIsolationTest(world: World) {
  const orgA = await world.org("Isolation A");
  const orgB = await world.org("Isolation B");

  for (const org of [orgA, orgB]) {
    for (const id of modules) await world.setModule(org, id, true);
  }

  const ownerA = await world.userIn(orgA, "owner", "Owner A");
  const colleague = await world.userIn(orgA, "member", "Colleague A");
  const ownerB = await world.userIn(orgB, "owner", "Owner B");

  const a = await world.caller(ownerA.user, orgA);
  const b = await world.caller(ownerB.user, orgB);
  const bUserId = ownerB.user.id;
  const bOrgId = orgB.id;

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

  const ids: Record<string, string> = {
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
  const slugs: Record<string, string> = {
    project: project.slug,
    doc: doc.slug,
  };

  return { a, b, ids, slugs, bUserId, bOrgId };
}
