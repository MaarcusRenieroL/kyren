import { expect, test } from "./fixtures";

import { registerWithOrganization, trpcMutation, uniqueName } from "./helpers";
import { expectNoSeriousA11yIssues, orgWithMember } from "./people-helpers";

test("the overview shows totals, a setup checklist and recent actions @admin", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "adminov",
    orgName: uniqueName("Admin overview"),
  });

  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Administration" }),
  ).toBeVisible();

  const members = page.locator("dl > div").filter({ hasText: "Members" });

  await expect(members).toContainText("1");
  await expect(
    page.locator("dl > div").filter({ hasText: "Storage" }),
  ).toContainText("0 B");

  // Setup steps link to where they are done, and none is ticked on day one.
  const setup = page.getByRole("region", { name: "Setup" });

  await expect(setup.getByRole("link")).toHaveCount(4);
  await expect(setup.getByLabel("Done")).toHaveCount(0);
  await setup.getByRole("link", { name: "Create a team" }).click();
  await expect(page).toHaveURL(/\/settings\/organization\/teams/);

  // A project ticks its step, and the work shows up under recent actions.
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(uniqueName("Setup"));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create project" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/admin");
  await expect(
    page.getByRole("region", { name: "Setup" }).getByLabel("Done"),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "Recent actions" })
      .getByRole("listitem")
      .first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open the full audit log" }).click();
  await expect(page).toHaveURL(/\/settings\/organization\/audit-log/);
});

test("usage and security pages report real figures @admin", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "adminsec");

  await page.goto("/admin/usage");
  await expect(
    page.getByRole("heading", { name: "Administration" }),
  ).toBeVisible();
  await expect(page.getByText("No files have been uploaded.")).toBeVisible();
  await expect(
    page.locator("dl > div").filter({ hasText: "Tasks" }),
  ).toContainText("0");

  await page.goto("/admin/security");
  const keys = page.getByRole("region", { name: "Who can administer" });

  // Only the owner administers; the plain member is not listed.
  await expect(keys.getByText(team.ownerEmail)).toBeVisible();
  await expect(keys.getByText(team.memberEmail)).toHaveCount(0);
  await expect(keys.getByText("owner", { exact: true })).toBeVisible();
  await expect(
    page.locator("dl > div").filter({ hasText: "Owners and admins" }),
  ).toContainText("1");

  // The section tabs navigate.
  await page.locator('a[href="/admin"]', { hasText: "Overview" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.locator('a[href="/admin/usage"]', { hasText: "Usage" }).click();
  await expect(page).toHaveURL(/\/admin\/usage$/);

  await team.close();
});

test("a plain member cannot open Administration, in the UI or the API @admin", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "adminperm");

  for (const path of ["/admin", "/admin/usage", "/admin/security"]) {
    await team.member.goto(path);
    await expect(
      team.member.getByText(/permission|access/i).first(),
    ).toBeVisible();
    await expect(team.member.getByText("Setup")).toHaveCount(0);
  }

  const response = await team.member.request.get(
    "/api/trpc/admin.overview?batch=1&input=" +
      encodeURIComponent(JSON.stringify({ 0: { json: null } })),
  );

  expect(response.status()).toBe(403);
  await team.member.goto("/dashboard");
  await expect(
    team.member.getByRole("link", { name: "Administration" }),
  ).toHaveCount(0);

  await team.close();
});

test("the module can be switched off and on, and the sidebar follows @admin", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "adminmod",
    orgName: uniqueName("Admin module"),
  });

  const modules = "/settings/organization/modules";

  await page.goto("/admin");
  await expect(
    page.getByRole("link", { name: "Administration" }).first(),
  ).toBeVisible();

  await page.goto(modules);
  for (const name of ["Administration", "HR", "Payroll", "Tickets"]) {
    await expect(
      page.getByRole("switch", { name: `${name} module` }),
    ).toBeChecked();
  }

  await page.getByRole("switch", { name: "Administration module" }).click();
  await expect(
    page.getByRole("switch", { name: "Administration module" }),
  ).not.toBeChecked();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/module-disabled\?module=admin/);

  await page.goto(modules);
  await page.getByRole("switch", { name: "Administration module" }).click();
  await expect(
    page.getByRole("switch", { name: "Administration module" }),
  ).toBeChecked();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
});

test("HR and Payroll turn off independently and keep their data @admin", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "adminhr",
    orgName: uniqueName("Admin hr"),
  });

  const name = uniqueName("Kept Person");

  await trpcMutation(page, "hr.create", {
    name,
    email: null,
    jobTitle: "",
    department: null,
    location: null,
    status: "active",
    startDate: null,
    endDate: null,
    managerId: null,
    memberId: null,
  });

  const modules = "/settings/organization/modules";

  await page.goto(modules);
  await page.getByRole("switch", { name: "HR module" }).click();
  await expect(
    page.getByRole("switch", { name: "HR module" }),
  ).not.toBeChecked();
  await page.goto("/hr");
  await expect(page).toHaveURL(/\/module-disabled\?module=hr/);

  // Payroll still works while HR is off.
  await page.goto("/payroll");
  await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();

  await page.goto(modules);
  await page.getByRole("switch", { name: "HR module" }).click();
  await expect(page.getByRole("switch", { name: "HR module" })).toBeChecked();
  await page.goto("/hr");
  await expect(page.getByText(name)).toBeVisible();
});

test("administration pages pass accessibility checks and fit a phone @admin", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "admina11y",
    orgName: uniqueName("Admin a11y"),
  });

  for (const path of ["/admin", "/admin/usage", "/admin/security"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Administration" }),
    ).toBeVisible();
    await expect(page.getByText("Loading…")).toHaveCount(0);
    await expectNoSeriousA11yIssues(page, path);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByText("Loading…")).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(overflow, "no horizontal page scroll on a phone").toBe(false);
});
