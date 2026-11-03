import { expect, test } from "./fixtures";

import {
  createProjectViaUi,
  createTaskViaUi,
  registerWithOrganization,
  uniqueName,
} from "./helpers";

test("an admin adds a task field, fills it in, and saves and reuses a view", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "fields",
    orgName: uniqueName("Fields org"),
  });
  await createProjectViaUi(page, uniqueName("Fields project"));
  const taskName = uniqueName("Field task");

  await createTaskViaUi(page, taskName);

  // Define a number field.
  await page.goto("/admin/task-fields");
  await expect(page.getByText("No task fields yet.")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Budget");
  await page.getByLabel("Type").selectOption("number");
  await page.getByRole("button", { name: "Add field" }).click();
  await expect(page.getByText("Budget").first()).toBeVisible();

  // Fill it in on the task.
  await page.goto("/tasks");
  await page.getByText(taskName).first().click();
  await expect(page).toHaveURL(/\/tasks\/[A-Z0-9]+-\d+/);

  const budget = page.getByLabel("Budget");

  await budget.fill("250");
  await budget.blur();
  await page.reload();
  await expect(page.getByLabel("Budget")).toHaveValue("250");

  // Save the list's filters as a view and apply it again.
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Save view" }).click();
  await page.getByLabel("View name").fill("Everything");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByLabel("Saved views")).toContainText("Everything");

  await page.reload();
  await page.getByLabel("Saved views").selectOption({ label: "Everything" });
  await expect(page.getByText(taskName).first()).toBeVisible();
});
