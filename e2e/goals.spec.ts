import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("a goal shows progress from its key results", async ({ page }) => {
  await registerWithOrganization(page, {
    label: "goals",
    orgName: uniqueName("Goals org"),
  });

  await page.goto("/tasks/goals");

  const goal = uniqueName("Grow revenue");

  await page.getByLabel("Goal title").fill(goal);
  await page.getByRole("button", { name: "Add goal" }).click();
  await expect(page.getByRole("heading", { name: goal })).toBeVisible();

  await page.getByLabel("Key result title").fill("Reach 200 customers");
  await page.getByLabel("Start value").fill("100");
  await page.getByLabel("Target value").fill("200");
  await page.getByRole("button", { name: "Add key result" }).click();

  await expect(page.getByText("Reach 200 customers")).toBeVisible();
  await expect(page.getByText("100 of 200")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: `${goal} progress` }),
  ).toHaveAttribute("aria-valuenow", "0");

  await page.getByRole("button", { name: `Delete goal ${goal}` }).click();
  await expect(page.getByText("No goals yet.")).toBeVisible();
});
