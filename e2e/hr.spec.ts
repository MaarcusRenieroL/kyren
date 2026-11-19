import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

import { query, registerWithOrganization, uniqueName } from "./helpers";
import { expectNoSeriousA11yIssues, orgWithMember } from "./people-helpers";

async function addPerson(
  page: Page,
  fields: {
    name: string;
    title?: string;
    department?: string;
    location?: string;
    account?: string;
    status?: string;
  },
) {
  await page.goto("/hr");
  await page.getByRole("button", { name: "Add person" }).first().click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Name", { exact: true }).fill(fields.name);

  if (fields.title) await dialog.getByLabel("Job title").fill(fields.title);
  if (fields.department)
    await dialog.getByLabel("Department").fill(fields.department);
  if (fields.location)
    await dialog.getByLabel("Location").fill(fields.location);
  if (fields.status)
    await dialog.getByLabel("Status").selectOption(fields.status);
  if (fields.account)
    await dialog.getByLabel("Sign-in account").selectOption({
      label: fields.account,
    });

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(fields.name).first()).toBeVisible();
}

test("the directory starts empty and a manager adds, edits and removes people @hr", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "hrdir",
    orgName: uniqueName("HR directory"),
  });

  await page.goto("/hr");
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.getByText("No one here yet")).toBeVisible();

  const ana = uniqueName("Ana Silva");
  const ben = uniqueName("Ben Okafor");

  await addPerson(page, {
    name: ana,
    title: "Head of Engineering",
    department: "Engineering",
    location: "Lisbon",
  });
  await addPerson(page, {
    name: ben,
    title: "Designer",
    department: "Design",
    location: "Lagos",
  });
  await expect(page.getByText("2 of 2")).toBeVisible();

  // Search and the department filter.
  await page.getByLabel("Search people").fill("Lagos");
  await expect(page.getByText("1 of 2")).toBeVisible();
  await expect(page.getByText(ana)).toHaveCount(0);
  await page.getByLabel("Search people").fill("nobody-here");
  await expect(page.getByText("Nothing matches")).toBeVisible();
  await page.getByLabel("Search people").fill("");
  await page.getByLabel("Department").selectOption("Design");
  await expect(page.getByText(ben)).toBeVisible();
  await expect(page.getByText(ana)).toHaveCount(0);
  await page.getByLabel("Department").selectOption("");

  // Edit Ben: a manager and a status chip.
  await page.getByRole("button", { name: `Edit ${ben}` }).click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Reports to").selectOption({ label: ana });
  await dialog.getByLabel("Status").selectOption("on_leave");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(`Reports to ${ana}`)).toBeVisible();
  await expect(page.getByText("On leave")).toBeVisible();

  // A person cannot be their own manager: the option is not offered.
  await page.getByRole("button", { name: `Edit ${ana}` }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Reports to").locator("option", {
      hasText: ana,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel" })
    .click();

  // Removing asks first.
  await page.getByRole("button", { name: `Edit ${ben}` }).click();
  page.once("dialog", (confirm) => void confirm.dismiss());
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  page.once("dialog", (confirm) => void confirm.accept());
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByText(ben)).toHaveCount(0);
  await expect(page.getByText("1 of 1")).toBeVisible();
});

test("the form validates the name and email @hr", async ({ page }) => {
  await registerWithOrganization(page, {
    label: "hrvalid",
    orgName: uniqueName("HR valid"),
  });

  await page.goto("/hr");
  await page.getByRole("button", { name: "Add person" }).first().click();

  const dialog = page.getByRole("dialog");

  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toContainText("name");

  await dialog.getByLabel("Name", { exact: true }).fill("Someone");
  await dialog.getByLabel("Email").fill("zed@nowhere");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toContainText("email");
});

test("an account can be linked to one person only @hr", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "hrlink");

  await addPerson(page, {
    name: team.memberName,
    account: `${team.memberName} (${team.memberEmail})`,
  });

  // The linked account is no longer offered for a second person.
  await page.getByRole("button", { name: "Add person" }).first().click();

  const options = page
    .getByRole("dialog")
    .getByLabel("Sign-in account")
    .locator("option");

  await expect(options.filter({ hasText: team.memberEmail })).toHaveCount(0);
  await expect(options.filter({ hasText: team.ownerEmail })).toHaveCount(1);

  await team.close();
});

test("time off: a member requests, cancels and re-requests; a manager approves and rejects @hr", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "hrleave");

  // Without an employee record there is nothing to request against.
  await team.member.goto("/hr/leave");
  await expect(team.member.getByText("No requests")).toBeVisible();
  await expect(
    team.member.getByRole("button", { name: "Request time off" }),
  ).toHaveCount(0);

  await addPerson(page, {
    name: team.memberName,
    account: `${team.memberName} (${team.memberEmail})`,
  });

  await team.member.goto("/hr/leave");
  await team.member
    .getByRole("button", { name: "Request time off" })
    .first()
    .click();

  const dialog = team.member.getByRole("dialog");

  // A request needs dates, and a weekend alone is refused.
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByRole("alert")).toContainText("first and last day");
  await dialog.getByLabel("First day").fill("2030-06-01");
  await dialog.getByLabel("Last day").fill("2030-06-02");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByRole("alert")).toContainText("weekend");

  // Mon 3 – Fri 7 June 2030 is five working days.
  await dialog.getByLabel("First day").fill("2030-06-03");
  await dialog.getByLabel("Last day").fill("2030-06-07");
  await dialog.getByLabel("Note (optional)").fill("Family trip");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(team.member.getByText("5 days")).toBeVisible();
  await expect(team.member.getByText("Family trip")).toBeVisible();
  await expect(team.member.getByText("pending")).toBeVisible();
  // A member cannot decide their own request.
  await expect(
    team.member.getByRole("button", { name: "Approve" }),
  ).toHaveCount(0);

  await team.member.getByRole("button", { name: "Cancel" }).click();
  await expect(team.member.getByText("cancelled")).toBeVisible();

  // Request again for the manager to decide.
  for (const [start, end, outcome] of [
    ["2030-07-01", "2030-07-02", "Approve"],
    ["2030-08-05", "2030-08-05", "Reject"],
  ] as const) {
    await team.member
      .getByRole("button", { name: "Request time off" })
      .first()
      .click();
    await team.member.getByLabel("First day").fill(start);
    await team.member.getByLabel("Last day").fill(end);
    await team.member.getByRole("button", { name: "Send request" }).click();
    await expect(team.member.getByRole("dialog")).toHaveCount(0);

    await page.goto("/hr/leave");

    const row = page
      .getByRole("listitem")
      .filter({ hasText: team.memberName })
      .filter({ hasText: "pending" });

    await row.getByRole("button", { name: outcome }).click();
    await expect(row).toHaveCount(0);
  }

  await page.reload();
  await expect(page.getByText("approved")).toBeVisible();
  await expect(page.getByText("rejected")).toBeVisible();

  // The member sees only their own requests, with the decisions.
  await team.member.reload();
  await expect(team.member.getByText("approved")).toBeVisible();
  await expect(team.member.getByText("rejected")).toBeVisible();

  const decided = await query<{ action: string }>(
    `select action from "activityEvent" where action = 'leave.decided'
       and "organizationId" = (select id from organization where name = $1)`,
    [team.orgName],
  );

  expect(decided).toHaveLength(2);

  await team.close();
});

test("members read the directory but cannot manage people or see others' leave @hr", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "hrperm");
  const colleague = uniqueName("Colleague");

  await addPerson(page, { name: colleague, title: "Analyst" });

  await team.member.goto("/hr");
  await expect(team.member.getByText(colleague)).toBeVisible();
  await expect(
    team.member.getByRole("button", { name: "Add person" }),
  ).toHaveCount(0);
  await expect(
    team.member.getByRole("button", { name: `Edit ${colleague}` }),
  ).toHaveCount(0);

  await team.member.goto("/hr/leave");
  await expect(
    team.member.getByRole("button", { name: /Approve|Reject/ }),
  ).toHaveCount(0);

  await team.close();
});

test("HR pages pass accessibility checks and fit a phone @hr", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "hra11y",
    orgName: uniqueName("HR a11y"),
  });
  await addPerson(page, { name: uniqueName("Ana Silva"), title: "Lead" });
  await expectNoSeriousA11yIssues(page, "directory");

  await page.goto("/hr/leave");
  await expect(page.getByRole("heading", { name: "Time off" })).toBeVisible();
  await expectNoSeriousA11yIssues(page, "time off");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/hr");
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(overflow, "no horizontal page scroll on a phone").toBe(false);
});

test("an empty directory offers one Add person button, in the empty state @hr", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "hrempty",
    orgName: uniqueName("HR empty"),
  });

  await page.goto("/hr");
  await expect(page.getByText("No one here yet")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("button", { name: "Add person" }),
  ).toHaveCount(1);
});
