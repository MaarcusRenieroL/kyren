import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("a person downloads their data, and the only owner cannot delete themselves @admin", async ({
  page,
}) => {
  const { email } = await registerWithOrganization(page, {
    label: "privacy",
    orgName: uniqueName("Privacy org"),
  });

  await page.goto("/settings/account/security");

  const download = page.waitForEvent("download");

  await page.getByRole("button", { name: "Download", exact: true }).click();

  const file = await download;

  expect(file.suggestedFilename()).toBe("my-zentro-data.json");

  await page.getByLabel("Type your email to confirm").fill(email);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(
    page.getByText("Make someone else an owner first."),
  ).toBeVisible();
  await expect(page).toHaveURL(/settings\/account\/security/);
});
