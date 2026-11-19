import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";
import { acceptNextConfirm } from "./people-helpers";

test("a goal shows progress from its key results, which can be updated and removed; goals can be renamed and closed @tasks", async ({
  page,
}) => {
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

  await expect(
    page.getByText("Reach 200 customers", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("100 of 200")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: `${goal} progress` }),
  ).toHaveAttribute("aria-valuenow", "0");

  // Moving the number moves the key result and the goal.
  await page.getByLabel("Current value for Reach 200 customers").fill("150");
  await page
    .getByLabel("Confidence for Reach 200 customers")
    .selectOption({ label: "At risk" });
  await page
    .getByLabel("Check-in note for Reach 200 customers")
    .fill("Two deals slipped to next quarter");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByText("150 of 200")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Reach 200 customers progress" }),
  ).toHaveAttribute("aria-valuenow", "50");
  await expect(
    page.getByRole("progressbar", { name: `${goal} progress` }),
  ).toHaveAttribute("aria-valuenow", "50");

  // Still there after a reload: it was saved.
  await page.reload();
  await expect(page.getByText("150 of 200")).toBeVisible();

  // The check-in is kept with its confidence and note.
  await expect(
    page.getByLabel("Confidence for Reach 200 customers"),
  ).toHaveValue("at_risk");
  await page
    .getByRole("button", { name: "Check-ins for Reach 200 customers" })
    .click();
  await expect(
    page.getByText("Two deals slipped to next quarter"),
  ).toBeVisible();

  acceptNextConfirm(page);
  await page
    .getByRole("button", { name: "Remove key result Reach 200 customers" })
    .click();
  await expect(
    page.getByText("Reach 200 customers", { exact: true }),
  ).toHaveCount(0);

  // Rename, then close (it stays closed after a reload) and reopen.
  const renamed = `${goal} (stretch)`;

  await page.getByRole("button", { name: `Rename goal ${goal}` }).click();
  await page.getByLabel(`New title for ${goal}`).fill(renamed);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: renamed })).toBeVisible();

  await page.getByRole("button", { name: `Close goal ${renamed}` }).click();
  await expect(page.getByText("Closed", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Closed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Reopen goal ${renamed}` }).click();
  await expect(page.getByText("Closed", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: `Delete goal ${renamed}` }).click();
  await expect(page.getByText("No goals yet.")).toBeVisible();
});
