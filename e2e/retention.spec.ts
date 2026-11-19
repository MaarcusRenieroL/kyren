import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("an admin sets a retention period and places, then lifts, a legal hold @admin", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "retention",
    orgName: uniqueName("Retention org"),
  });

  await page.goto("/admin/retention");
  await page.getByLabel("Chat messages: keep for days").fill("90");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Retention saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Chat messages: keep for days")).toHaveValue(
    "90",
  );

  await page.getByLabel("Reason for the legal hold").fill("Case 12");
  await page.getByRole("button", { name: "Place hold" }).click();
  await expect(page.getByText("On: Case 12")).toBeVisible();
  await page.getByRole("button", { name: "Lift hold" }).click();
  await expect(page.getByRole("button", { name: "Place hold" })).toBeVisible();
});
