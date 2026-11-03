import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";
import { expectNoSeriousA11yIssues } from "./people-helpers";

test("notification choices save and survive a reload", async ({ page }) => {
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
