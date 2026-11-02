import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

import {
  query,
  registerWithOrganization,
  trpcMutation,
  uniqueName,
} from "./helpers";
import {
  acceptNextConfirm,
  expectNoSeriousA11yIssues,
  orgWithMember,
} from "./people-helpers";

async function hire(page: Page, name: string, memberId: string | null = null) {
  return trpcMutation<{ id: string }>(page, "hr.create", {
    name,
    email: null,
    jobTitle: "Engineer",
    department: null,
    location: null,
    status: "active",
    startDate: null,
    endDate: null,
    managerId: null,
    memberId,
  });
}

async function setSalaryViaUi(page: Page, name: string, amount: string) {
  await page.goto("/payroll");
  await page.getByRole("tab", { name: "Salaries" }).click();
  await page.getByLabel(`Annual salary for ${name}`).fill(amount);
  await page
    .getByRole("listitem")
    .filter({ hasText: name })
    .getByRole("button", { name: "Save" })
    .click();
  await expect(page.getByText("Salary saved")).toBeVisible();
}

async function createRun(page: Page, label: string, rate = "20") {
  await page.goto("/payroll");
  await page.getByRole("button", { name: "New pay run" }).click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Name").fill(label);
  await dialog.getByLabel("Period start").fill("2030-06-01");
  await dialog.getByLabel("Period end").fill("2030-06-30");
  await dialog.getByLabel("Tax and contributions (%)").fill(rate);
  await dialog.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/payroll\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: label })).toBeVisible();
}

test("a new organization has no runs or salaries, and a run needs a salary first", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "payempty",
    orgName: uniqueName("Payroll empty"),
  });

  await page.goto("/payroll");
  await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();
  await expect(page.getByText("No pay runs yet")).toBeVisible();

  await page.getByRole("tab", { name: "Salaries" }).click();
  await expect(page.getByText("No employees yet")).toBeVisible();

  await hire(page, uniqueName("Ana"));
  await page.goto("/payroll");

  // Without a salary the draft cannot be built.
  await page.getByRole("button", { name: "New pay run" }).click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Name").fill("Too early");
  await dialog.getByRole("button", { name: "Create draft" }).click();
  await expect(dialog.getByRole("alert")).toContainText("period");
  await dialog.getByLabel("Period start").fill("2030-06-01");
  await dialog.getByLabel("Period end").fill("2030-06-30");
  await dialog.getByRole("button", { name: "Create draft" }).click();
  await expect(dialog.getByRole("alert")).toContainText("salary");
});

test("salaries, a draft run, bonuses, approval and payment follow the pay arithmetic", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "paycycle",
    orgName: uniqueName("Payroll cycle"),
  });

  const ana = uniqueName("Ana");
  const ben = uniqueName("Ben");

  await hire(page, ana);
  await hire(page, ben);
  await setSalaryViaUi(page, ana, "60000");
  await setSalaryViaUi(page, ben, "120000");

  // Saved salaries survive a reload.
  await page.reload();
  await page.getByRole("tab", { name: "Salaries" }).click();
  await expect(page.getByLabel(`Annual salary for ${ana}`)).toHaveValue(
    "60000",
  );

  await createRun(page, "June 2030");

  // A twelfth of the salary, 20% held back.
  const anaRow = page.getByRole("row").filter({ hasText: ana });
  const benRow = page.getByRole("row").filter({ hasText: ben });

  await expect(anaRow).toContainText("$5,000.00");
  await expect(anaRow).toContainText("$1,000.00");
  await expect(anaRow).toContainText("$4,000.00");
  await expect(benRow).toContainText("$10,000.00");
  await expect(benRow).toContainText("$8,000.00");
  await expect(page.getByText("Net to pay")).toBeVisible();
  await expect(page.getByText("$12,000.00").first()).toBeVisible();

  // A $1,000 bonus raises gross, deductions and net.
  await page.getByLabel(`Bonus for ${ana}`).fill("1000");
  await anaRow.getByRole("button", { name: "Set" }).click();
  await expect(anaRow).toContainText("$1,200.00");
  await expect(anaRow).toContainText("$4,800.00");

  // The list shows the draft with its total.
  await page.goto("/payroll");
  await expect(page.getByRole("link", { name: /June 2030/ })).toContainText(
    "2 people",
  );
  await expect(page.getByRole("link", { name: /June 2030/ })).toContainText(
    "$12,800.00",
  );
  await expect(page.getByRole("link", { name: /June 2030/ })).toContainText(
    "draft",
  );

  await page.getByRole("link", { name: /June 2030/ }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();

  // An approved run is frozen: no bonus inputs, no approve, no delete.
  await expect(page.getByLabel(`Bonus for ${ana}`)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Mark as paid" }).click();
  await expect(page.getByText("paid", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as paid" })).toHaveCount(
    0,
  );

  const events = await query<{ action: string }>(
    `select action from "activityEvent" where action like 'payroll.%'
       and "organizationId" = (select "organizationId" from employee where name = $1)
       order by "createdAt"`,
    [ana],
  );

  expect(events.map((event) => event.action)).toEqual([
    "payroll.salary_set",
    "payroll.salary_set",
    "payroll.run_created",
    "payroll.bonus_set",
    "payroll.run_approved",
    "payroll.run_paid",
  ]);
});

test("a draft run can be deleted after a confirm, and a bad salary is refused", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "paydel",
    orgName: uniqueName("Payroll delete"),
  });

  const ana = uniqueName("Ana");

  await hire(page, ana);
  await page.goto("/payroll");
  await page.getByRole("tab", { name: "Salaries" }).click();
  await page.getByLabel(`Annual salary for ${ana}`).fill("abc");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Enter a salary")).toBeVisible();

  await setSalaryViaUi(page, ana, "48000");
  await createRun(page, "Throwaway");

  page.once("dialog", (confirm) => void confirm.dismiss());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/payroll\/[0-9a-f-]{36}/);

  acceptNextConfirm(page);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/payroll$/);
  await expect(page.getByText("No pay runs yet")).toBeVisible();
});

test("members see only their own payslip, and only after approval", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "payown");

  const memberEmployee = await hire(page, team.memberName, null);
  const ana = uniqueName("Ana");

  await hire(page, ana);

  // Link the member's account to their employee record.
  await query(
    `update employee set "memberId" = (
       select m.id from member m join "user" u on u.id = m."userId"
       where u.email = $1 and m."organizationId" = employee."organizationId")
     where id = $2`,
    [team.memberEmail, memberEmployee.id],
  );

  await setSalaryViaUi(page, team.memberName, "36000");
  await setSalaryViaUi(page, ana, "90000");
  await createRun(page, "Own payslip run");

  const runUrl = page.url();

  // Members only get their own tab.
  await team.member.goto("/payroll");
  await expect(
    team.member.getByRole("heading", { name: "Payroll" }),
  ).toBeVisible();
  await expect(team.member.getByRole("tab", { name: "Pay runs" })).toHaveCount(
    0,
  );
  await expect(team.member.getByRole("tab", { name: "Salaries" })).toHaveCount(
    0,
  );
  await expect(
    team.member.getByRole("tab", { name: "My payslips" }),
  ).toBeVisible();
  await expect(team.member.getByText("No payslips yet")).toBeVisible();

  // The run page is closed to them.
  await team.member.goto(runUrl);
  await expect(team.member.getByText("Pay run not found")).toBeVisible();

  await page.goto(runUrl);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();

  await team.member.goto("/payroll");
  const slip = team.member.getByRole("listitem").filter({
    hasText: "Own payslip run",
  });

  await expect(slip).toContainText("$3,000.00");
  await expect(slip).toContainText("$600.00");
  await expect(slip).toContainText("$2,400.00");
  // Nobody else's pay appears.
  await expect(team.member.getByText(ana)).toHaveCount(0);
  await expect(team.member.getByText("$7,500.00")).toHaveCount(0);

  await team.close();
});

test("payroll pages pass accessibility checks and fit a phone", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "paya11y",
    orgName: uniqueName("Payroll a11y"),
  });

  const ana = uniqueName("Ana");

  await hire(page, ana);
  await setSalaryViaUi(page, ana, "60000");
  await expectNoSeriousA11yIssues(page, "salaries");
  await createRun(page, "Access run");
  await expectNoSeriousA11yIssues(page, "run page");

  await page.goto("/payroll");
  await expect(page.getByRole("link", { name: /Access run/ })).toBeVisible();
  await expectNoSeriousA11yIssues(page, "run list");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/payroll");
  await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(overflow, "no horizontal page scroll on a phone").toBe(false);
});
