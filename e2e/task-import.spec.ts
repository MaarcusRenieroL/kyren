import { expect, test } from "./fixtures";

import { registerWithOrganization, trpcMutation, uniqueName } from "./helpers";
import { expectNoSeriousA11yIssues } from "./people-helpers";

test("tasks import from a CSV file into a chosen project @tasks", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "import",
    orgName: uniqueName("Import org"),
  });

  const project = uniqueName("Import project");

  await trpcMutation(page, "project.createProject", {
    name: project,
    slug: project.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description: "",
  });

  await page.goto("/tasks/import");
  await expectNoSeriousA11yIssues(page, "task import");

  await page.getByLabel("Project").selectOption({ label: project });
  await page.getByLabel("CSV file").setInputFiles({
    name: "tasks.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Name,Status,Priority\nWrite the brief,In progress,High\nReview copy,,\n",
    ),
  });

  await expect(page.getByText("tasks.csv: 2 tasks ready.")).toBeVisible();
  await page.getByRole("button", { name: "Import tasks" }).click();

  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByText("Write the brief").first()).toBeVisible();
  await expect(page.getByText("Review copy").first()).toBeVisible();
});
