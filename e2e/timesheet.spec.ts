import { expect, test } from "./fixtures";

import {
  createProjectViaUi,
  createTaskViaUi,
  registerWithOrganization,
  uniqueName,
} from "./helpers";

test("a timer survives a reload, stopping it logs the time, and the timesheet shows it", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "timer",
    orgName: uniqueName("Timer org"),
  });
  await createProjectViaUi(page, uniqueName("Timer project"));
  const taskName = uniqueName("Timed task");

  await createTaskViaUi(page, taskName);
  await page.goto("/tasks");
  await page.getByText(taskName).first().click();
  await expect(page).toHaveURL(/\/tasks\/[A-Z0-9]+-\d+/);

  await page.getByRole("button", { name: "Start Timer" }).click();
  await expect(page.getByRole("button", { name: /^Stop/ })).toBeVisible();

  // The clock lives on the server, so a reload keeps it running.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Stop/ })).toBeVisible();

  await page.getByRole("button", { name: /^Stop/ }).click();
  await expect(page.getByText("1m logged")).toBeVisible();

  await page.goto("/tasks/timesheet");
  await expect(page.getByText("Total this week: 1m")).toBeVisible();
  await expect(page.getByText(taskName).first()).toBeVisible();
});
