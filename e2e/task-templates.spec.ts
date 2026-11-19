import { expect, test } from "./fixtures";

import {
  createProjectViaUi,
  createTaskViaUi,
  registerWithOrganization,
  uniqueName,
} from "./helpers";

test("a template creates a task and its steps in a project @tasks", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "template",
    orgName: uniqueName("Template org"),
  });
  const projectName = uniqueName("Template project");

  await createProjectViaUi(page, projectName);
  await createTaskViaUi(page, uniqueName("First task"));
  await page.goto("/projects");

  const href = await page
    .getByRole("link", { name: new RegExp(projectName) })
    .first()
    .getAttribute("href");
  const slug = href!.split("/").pop()!;

  await page.goto(`/tasks?project=${slug}`);
  await page.getByText("Task templates").click();

  const name = uniqueName("Onboard customer");
  const step = uniqueName("Send welcome");

  await page.getByLabel("Template name").fill(name);
  await page.getByLabel("Template steps").fill(`${step}\nBook a call`);
  await page.getByRole("button", { name: "Add template" }).click();
  await expect(page.getByText(`${name} · 2 steps`)).toBeVisible();

  await page
    .locator("li", { hasText: name })
    .getByRole("button", { name: "Use" })
    .click();

  await expect(page.getByText(step).first()).toBeVisible({ timeout: 15_000 });
});
