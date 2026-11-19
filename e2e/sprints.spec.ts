import { expect, test } from "./fixtures";

import {
  createProjectViaUi,
  createTaskViaUi,
  registerWithOrganization,
  uniqueName,
} from "./helpers";

test("a project plans a sprint, runs it, and completes it @tasks", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "sprint",
    orgName: uniqueName("Sprint org"),
  });
  const projectName = uniqueName("Sprint project");

  await createProjectViaUi(page, projectName);
  const taskName = uniqueName("Sprint task");

  await createTaskViaUi(page, taskName);

  await page.goto("/projects");

  const href = await page
    .getByRole("link", { name: new RegExp(projectName) })
    .first()
    .getAttribute("href");
  const slug = href!.split("/").pop()!;

  await page.goto(`/tasks?project=${slug}`);
  await expect(page.getByText("No sprint running")).toBeVisible();

  await page.getByRole("button", { name: "New sprint" }).click();
  await page.getByLabel("Sprint name").fill("Sprint Alpha");
  await page.getByRole("button", { name: "Create sprint" }).click();

  await page
    .getByRole("button", { name: "Add 1 unplanned to Sprint Alpha" })
    .click();
  await page.getByRole("button", { name: "Start Sprint Alpha" }).click();

  await expect(page.getByText("Sprint Alpha").first()).toBeVisible();
  await expect(page.getByText("0 of 1 tasks done")).toBeVisible();

  // Only the sprint's tasks show when the scope is the sprint.
  await page.getByRole("radio", { name: "Unplanned" }).click();
  await expect(page.getByText(taskName)).toHaveCount(0);
  await page.getByRole("radio", { name: "Sprint", exact: true }).click();
  await expect(page.getByText(taskName).first()).toBeVisible();

  await page.getByLabel("Unfinished work goes to").selectOption("backlog");
  await page.getByRole("button", { name: "Complete sprint" }).click();
  await expect(page.getByText("No sprint running")).toBeVisible();
});
