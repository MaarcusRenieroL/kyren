import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { query, trpcMutation, trpcQuery, uniqueName } from "./helpers";
import { orgWithMember } from "./people-helpers";

type Project = { id: string; slug: string };

const memberIdOf = async (orgName: string, email: string) =>
  (
    await query<{ id: string }>(
      `select m.id from member m
         join organization o on o.id = m."organizationId"
         join "user" u on u.id = m."userId"
        where o.name = $1 and u.email = $2`,
      [orgName, email],
    )
  )[0]!.id;

const timersOf = async (orgName: string, email: string) =>
  (
    await query<{ n: number }>(
      `select count(*)::int as n from "runningTimer" r
         join organization o on o.id = r."organizationId"
         join "user" u on u.id = r."userId"
        where o.name = $1 and u.email = $2`,
      [orgName, email],
    )
  )[0]!.n;

async function createTask(
  owner: Page,
  projectId: string,
  name: string,
  assignedToMemberId: string,
) {
  return trpcMutation<{ key: string }>(owner, "task.createTask", {
    projectId,
    name,
    assignedToMemberId,
    dueDate: new Date().toISOString().slice(0, 10),
  });
}

async function createProject(owner: Page, name: string) {
  return trpcMutation<Project>(owner, "project.createProject", {
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description: "",
  });
}

test("a plain member opening Overview gets the owners-and-admins empty state and no org data @dashboard", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "dash-overview");

  await team.member.goto("/overview");
  await expect(
    team.member.getByRole("heading", {
      name: "Overview is for owners and admins",
    }),
  ).toBeVisible();
  await expect(team.member.getByText(team.ownerEmail)).toHaveCount(0);
  await expect(team.member.getByText(team.ownerName)).toHaveCount(0);
  await expect(team.member.getByText("Tasks done · 7d")).toHaveCount(0);

  // Control: the owner does see the real Overview.
  await page.goto("/overview");
  await expect(page.getByText("Tasks done · 7d").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Overview is for owners and admins" }),
  ).toHaveCount(0);

  await team.close();
});

test("Today never shows work from a private project the viewer cannot see @dashboard", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "dash-private");
  const memberId = await memberIdOf(team.orgName, team.memberEmail);

  const open = await createProject(page, "Open ground");
  const secret = await createProject(page, "Secret ground");

  await trpcMutation(page, "project.updateAccess", {
    slug: secret.slug,
    visibility: "private",
    teamId: null,
  });

  const ownName = uniqueName("Visible chore");
  const hiddenName = uniqueName("Hidden heist");

  await createTask(page, open.id, ownName, memberId);
  const hidden = await createTask(page, secret.id, hiddenName, memberId);

  await team.member.goto("/dashboard");
  await expect(
    team.member.getByRole("link", { name: ownName }).first(),
  ).toBeVisible();
  await expect(team.member.getByText(hiddenName)).toHaveCount(0);
  await expect(team.member.getByText(hidden.key)).toHaveCount(0);
  await expect(team.member.getByText("Secret ground")).toHaveCount(0);

  // The owner does see it, so the absence above is not an empty page.
  await page.goto("/dashboard");
  await expect(page.getByText(hiddenName).first()).toBeVisible();

  await team.close();
});

test("a member without tasks.update_own can start neither the timer (API) nor the task (Today) @dashboard", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "dash-notimer");
  const memberId = await memberIdOf(team.orgName, team.memberEmail);
  const project = await createProject(page, "Timer ground");
  const taskName = uniqueName("Timed chore");
  const task = await createTask(page, project.id, taskName, memberId);

  const roles = await trpcQuery<
    Array<{ id: string; systemKey: string | null; permissions: string[] }>
  >(page, "permissions.roles.list");
  const memberRole = roles.find((role) => role.systemKey === "member")!;

  await trpcMutation(page, "permissions.roles.update", {
    id: memberRole.id,
    permissions: memberRole.permissions.filter(
      (permission) =>
        permission !== "tasks.update_own" && permission !== "tasks.update_any",
    ),
  });

  const denied = await team.member.request.post(
    "/api/trpc/timesheet.start?batch=1",
    { data: { 0: { json: { key: task.key } } } },
  );

  expect(denied.status()).toBe(403);

  await team.member.goto("/dashboard");
  await expect(
    team.member.getByRole("link", { name: taskName }).first(),
  ).toBeVisible();

  const start = team.member.getByRole("button", { name: /^Start/ });

  // Start on Today first moves the task to in progress; the server refuses
  // that change, so the timer is never reached, and Today says so.
  await start.click();
  await expect(
    team.member.getByText("Could not start the task").first(),
  ).toBeVisible();

  await expect(
    team.member.getByRole("main").getByText(/Running since/),
  ).toHaveCount(0);
  expect(await timersOf(team.orgName, team.memberEmail)).toBe(0);

  await team.close();
});

test("pausing only ever stops the caller's own timer @dashboard", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "dash-owntimer");
  const memberId = await memberIdOf(team.orgName, team.memberEmail);
  const ownerId = await memberIdOf(team.orgName, team.ownerEmail);
  const project = await createProject(page, "Two timers");

  await createTask(page, project.id, uniqueName("Owner work"), ownerId);
  await createTask(page, project.id, uniqueName("Member work"), memberId);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(page.getByRole("main").getByText(/Running since/)).toBeVisible();

  await team.member.goto("/dashboard");
  await team.member.getByRole("button", { name: /^Start/ }).click();
  await expect(
    team.member.getByRole("main").getByText(/Running since/),
  ).toBeVisible();

  await expect
    .poll(async () => [
      await timersOf(team.orgName, team.ownerEmail),
      await timersOf(team.orgName, team.memberEmail),
    ])
    .toEqual([1, 1]);

  await team.member.getByRole("button", { name: /^Pause/ }).click();
  await expect(
    team.member.getByRole("button", { name: /^Resume/ }),
  ).toBeVisible();

  await expect.poll(() => timersOf(team.orgName, team.memberEmail)).toBe(0);
  expect(await timersOf(team.orgName, team.ownerEmail)).toBe(1);

  await page.reload();
  await expect(page.getByRole("main").getByText(/Running since/)).toBeVisible();

  await team.close();
});

test("an admin whose role lost private projects doesn't see them on Overview @dashboard", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "dash-admin-scope");

  await query(
    `update member set role = 'admin'
       where "organizationId" = (select id from organization where name = $1)
         and "userId" = (select id from "user" where email = $2)`,
    [team.orgName, team.memberEmail],
  );

  const openName = uniqueName("Shared plans");
  const secretName = uniqueName("Board plans");

  await createProject(page, openName);

  const secret = await createProject(page, secretName);

  await trpcMutation(page, "project.updateAccess", {
    slug: secret.slug,
    visibility: "private",
    teamId: null,
  });

  const roles = await trpcQuery<
    Array<{ id: string; systemKey: string | null; permissions: string[] }>
  >(page, "permissions.roles.list");
  const adminRole = roles.find((role) => role.systemKey === "admin")!;

  await trpcMutation(page, "permissions.roles.update", {
    id: adminRole.id,
    permissions: adminRole.permissions.filter(
      (permission) => permission !== "projects.view_private",
    ),
  });

  // The owner still sees both.
  await page.goto("/overview");
  await expect(page.getByText(openName).first()).toBeVisible();
  await expect(page.getByText(secretName).first()).toBeVisible();

  // The narrowed admin sees the shared one and not the private one.
  await team.member.goto("/overview");
  await expect(team.member.getByText(openName).first()).toBeVisible();
  await expect(team.member.getByText(secretName)).toHaveCount(0);

  await team.close();
});
