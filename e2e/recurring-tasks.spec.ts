import { expect, test } from "./fixtures";

import {
  createProjectViaUi,
  createTaskViaUi,
  registerWithOrganization,
  uniqueName,
} from "./helpers";

test("a repeating task creates its first task once it falls due", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "repeat",
    orgName: uniqueName("Repeat org"),
  });
  const projectName = uniqueName("Repeat project");

  await createProjectViaUi(page, projectName);
  await createTaskViaUi(page, uniqueName("First task"));
  await page.goto("/projects");

  const href = await page
    .getByRole("link", { name: new RegExp(projectName) })
    .first()
    .getAttribute("href");
  const slug = href!.split("/").pop()!;

  await page.goto(`/tasks?project=${slug}`);
  await page.getByText("Repeating tasks").click();

  const name = uniqueName("Weekly report");
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  await page.getByLabel("Repeating task name").fill(name);
  await page.getByLabel("First task on").fill(yesterday);
  await page.getByRole("button", { name: "Add repeating task" }).click();
  await expect(page.locator("span", { hasText: "Every week" })).toBeVisible();

  // Loading the task list runs the background jobs, as any busy page does.
  await expect(async () => {
    await page.goto(`/tasks?project=${slug}`);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 40_000 });
});
