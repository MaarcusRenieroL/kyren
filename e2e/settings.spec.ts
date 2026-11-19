import type { APIResponse, Browser, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  addMemberDirectly,
  newContext,
  query,
  registerUser,
  signIn,
  trpcMutation,
  trpcQuery,
  uniqueName,
} from "./helpers";
import { orgWithMember } from "./people-helpers";

type RoleRow = { id: string; name: string; systemKey: string | null };

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

const isMember = async (orgName: string, email: string) =>
  (
    await query<{ n: number }>(
      `select count(*)::int as n from member m
         join organization o on o.id = m."organizationId"
         join "user" u on u.id = m."userId"
        where o.name = $1 and u.email = $2`,
      [orgName, email],
    )
  )[0]!.n === 1;

/** The tRPC error code of a batched response (a refused batch is a 207). */
async function errorCodeOf(response: APIResponse) {
  const body = (await response.json()) as Array<{
    error?: { json: { data: { code: string } } };
  }>;

  return body[0]?.error?.json.data.code ?? null;
}

const nameOf = async (email: string) =>
  (
    await query<{ name: string }>(`select name from "user" where email = $1`, [
      email,
    ])
  )[0]!.name;

/** Registers a user, makes them an admin of `orgName` and signs them in. */
async function addAdmin(browser: Browser, orgName: string, label: string) {
  const session = await newContext(browser);
  const { email } = await registerUser(session.page, label);

  await addMemberDirectly(orgName, email, "admin");
  await session.context.clearCookies();
  await signIn(session.page, email);
  await expect(session.page).toHaveURL(/\/dashboard/);

  return { ...session, email, name: await nameOf(email) };
}

const rowOf = (page: Page, email: string) =>
  page.getByRole("row").filter({ hasText: email });

async function roleIds(owner: Page) {
  const roles = await trpcQuery<RoleRow[]>(owner, "permissions.roles.list");

  return {
    admin: roles.find((role) => role.systemKey === "admin")!.id,
    member: roles.find((role) => role.systemKey === "member")!.id,
  };
}

test("a plain member opening the roles pages sees no role data @settings", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "set-roles");
  const roleName = uniqueName("Secret role");

  await trpcMutation(page, "permissions.roles.create", {
    name: roleName,
    scope: "organization",
    permissions: [],
  });

  // Control: the owner sees the custom role and its entry in the log.
  await page.goto("/settings/organization/roles");
  await expect(page.getByRole("link", { name: roleName })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toBeVisible();
  await page.goto("/settings/organization/roles/log");
  await expect(page.getByText("role.created").first()).toBeVisible();

  // The member gets the no-access page, rendered on the server, with none
  // of the role data; the API behind it refuses them too (below).
  for (const path of [
    "/settings/organization/roles",
    "/settings/organization/roles/log",
  ]) {
    await team.member.goto(path);
    await expect(
      team.member.getByRole("heading", {
        name: "You don’t have access to this.",
      }),
    ).toBeVisible();
    await expect(team.member).toHaveURL(new RegExp(`${path}$`));
    await expect(team.member.getByText(roleName)).toHaveCount(0);
    await expect(
      team.member.getByRole("link", { name: "Admin", exact: true }),
    ).toHaveCount(0);
    await expect(team.member.getByText("role.created")).toHaveCount(0);
  }

  for (const path of ["permissions.roles.list", "permissions.log.list"]) {
    const direct = await team.member.request.get(
      `/api/trpc/${path}?batch=1&input=` +
        encodeURIComponent(
          JSON.stringify({ 0: { json: path.includes("log") ? {} : null } }),
        ),
    );
    const directBody = await direct.text();

    expect(JSON.parse(directBody)[0].error.json.data.code, path).toBe(
      "FORBIDDEN",
    );
    expect(directBody).not.toContain(roleName);
  }

  await team.close();
});

test("an admin cannot act on other admins or the owner on the members page @settings", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "set-peers");
  const adminA = await addAdmin(browser, team.orgName, "set-peers-a");
  const adminB = await addAdmin(browser, team.orgName, "set-peers-b");

  await adminA.page.goto("/settings/organization/members");
  await expect(rowOf(adminA.page, adminB.email)).toBeVisible();

  // The plain member can be managed.
  const memberRow = rowOf(adminA.page, team.memberEmail);

  await expect(
    memberRow.getByRole("combobox", { name: `Role for ${team.memberName}` }),
  ).toBeVisible();
  await memberRow.getByRole("button", { name: "Open member actions" }).click();
  await expect(
    adminA.page.getByRole("menuitem", { name: "Remove member" }),
  ).toBeVisible();
  await adminA.page.keyboard.press("Escape");

  // Another admin and the owner are read-only.
  for (const target of [
    { email: adminB.email, role: "Admin" },
    { email: team.ownerEmail, role: "Owner" },
  ]) {
    const row = rowOf(adminA.page, target.email);

    await expect(row.getByText(target.role, { exact: true })).toBeVisible();
    await expect(row.getByRole("combobox")).toHaveCount(0);
    await expect(
      row.getByRole("button", { name: "Open member actions" }),
    ).toHaveCount(0);
  }

  // The API agrees.
  const adminBId = await memberIdOf(team.orgName, adminB.email);
  const ownerId = await memberIdOf(team.orgName, team.ownerEmail);

  for (const [path, input] of [
    ["member.remove", { memberId: adminBId }],
    ["member.remove", { memberId: ownerId }],
    ["member.updateRole", { memberId: adminBId, role: "member" }],
  ] as const) {
    const refused = await adminA.page.request.post(
      `/api/trpc/${path}?batch=1`,
      { data: { 0: { json: input } } },
    );

    expect(await errorCodeOf(refused), path).toBe("FORBIDDEN");
  }

  expect(await isMember(team.orgName, adminB.email)).toBe(true);
  expect(await isMember(team.orgName, team.ownerEmail)).toBe(true);
  expect(
    (
      await query<{ role: string }>(`select role from member where id = $1`, [
        adminBId,
      ])
    )[0]!.role,
  ).toBe("admin");

  // Control: the owner is offered Remove on admin B.
  await page.goto("/settings/organization/members");
  await rowOf(page, adminB.email)
    .getByRole("button", { name: "Open member actions" })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Remove member" }),
  ).toBeVisible();

  await adminA.context.close();
  await adminB.context.close();
  await team.close();
});

test("the owner can remove an admin and an admin can remove a plain member @settings", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "set-remove");
  const adminA = await addAdmin(browser, team.orgName, "set-remove-a");
  const adminB = await addAdmin(browser, team.orgName, "set-remove-b");

  await trpcMutation(adminA.page, "member.remove", {
    memberId: await memberIdOf(team.orgName, team.memberEmail),
  });
  expect(await isMember(team.orgName, team.memberEmail)).toBe(false);

  await trpcMutation(page, "member.remove", {
    memberId: await memberIdOf(team.orgName, adminB.email),
  });
  expect(await isMember(team.orgName, adminB.email)).toBe(false);
  expect(await isMember(team.orgName, adminA.email)).toBe(true);

  await adminA.context.close();
  await adminB.context.close();
  await team.close();
});

test("the Admin role is read-only for admins and editable for the owner @settings", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "set-adminrole");
  const adminA = await addAdmin(browser, team.orgName, "set-adminrole-a");
  const ids = await roleIds(page);

  // Admin on the Admin role: readable, not editable.
  await adminA.page.goto(`/settings/organization/roles/${ids.admin}`);
  await expect(
    adminA.page.getByRole("heading", { name: "Admin", exact: true }),
  ).toBeVisible();
  await expect(
    adminA.page.getByRole("switch", { name: "View tasks", exact: true }),
  ).toBeDisabled();
  await expect(
    adminA.page.getByRole("button", { name: "Save changes" }),
  ).toHaveCount(0);
  await expect(
    adminA.page.getByRole("button", { name: "Reset to default" }),
  ).toHaveCount(0);

  // Control: the same admin can edit the Member role.
  await adminA.page.goto(`/settings/organization/roles/${ids.member}`);
  await expect(
    adminA.page.getByRole("heading", { name: "Member", exact: true }),
  ).toBeVisible();
  await expect(
    adminA.page.getByRole("button", { name: "Save changes" }),
  ).toBeVisible();
  await expect(
    adminA.page.getByRole("button", { name: "Reset to default" }),
  ).toBeVisible();

  // Control: the owner can edit the Admin role.
  await page.goto(`/settings/organization/roles/${ids.admin}`);
  await expect(
    page.getByRole("heading", { name: "Admin", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset to default" }),
  ).toBeVisible();

  // The API refuses the admin both ways, and the owner may.
  const adminRole = await trpcQuery<{ permissions: string[] }>(
    page,
    "permissions.roles.get",
    { id: ids.admin },
  );

  for (const [path, input] of [
    [
      "permissions.roles.update",
      { id: ids.admin, permissions: adminRole.permissions.slice(1) },
    ],
    ["permissions.roles.resetSystem", { systemKey: "admin" }],
  ] as const) {
    const refused = await adminA.page.request.post(
      `/api/trpc/${path}?batch=1`,
      { data: { 0: { json: input } } },
    );

    expect(await errorCodeOf(refused), path).toBe("FORBIDDEN");
  }

  const after = await trpcQuery<{ permissions: string[] }>(
    page,
    "permissions.roles.get",
    { id: ids.admin },
  );

  expect([...after.permissions].sort()).toEqual(
    [...adminRole.permissions].sort(),
  );

  await trpcMutation(page, "permissions.roles.update", {
    id: ids.admin,
    permissions: adminRole.permissions,
  });

  await adminA.context.close();
  await team.close();
});
