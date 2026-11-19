import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";
import { expectNoSeriousA11yIssues } from "./people-helpers";

test("notification choices save and survive a reload @settings", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "notif",
    orgName: uniqueName("Notif org"),
  });
  await page.goto("/settings/account/notifications");

  const comments = page.getByRole("checkbox", {
    name: "Show comments in my inbox",
  });
  const mentions = page.getByRole("checkbox", {
    name: "Show mentions in my inbox",
  });

  await expect(comments).toBeChecked();
  await expectNoSeriousA11yIssues(page, "notification settings");

  await comments.uncheck();
  await page.reload();

  await expect(comments).not.toBeChecked();
  await expect(mentions).toBeChecked();
});

test("a person can download their own data @settings", async ({ page }) => {
  await registerWithOrganization(page, {
    label: "export",
    orgName: uniqueName("Export org"),
  });
  await page.goto("/settings/account/profile");

  const download = page.waitForEvent("download");

  await page.getByRole("button", { name: "Download my data" }).click();

  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^my-data-\d{4}-\d{2}-\d{2}\.json$/);
});
