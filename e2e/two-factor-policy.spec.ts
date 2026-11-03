import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";
import { expectNoSeriousA11yIssues } from "./people-helpers";

test("requiring two-factor needs it on your own account first, and the enrollment page works", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "policy",
    orgName: uniqueName("Policy org"),
  });
  await page.goto("/admin/security");

  const requirement = page.getByRole("checkbox", {
    name: /Require two-factor sign-in for everyone/,
  });

  await expect(requirement).not.toBeChecked();
  await requirement.click();
  await expect(
    page.getByText(/Turn on two-factor for your own account first/),
  ).toBeVisible();
  await expect(requirement).not.toBeChecked();

  await page.goto("/auth/two-factor-required");
  await expect(
    page.getByRole("heading", {
      name: "Your organization requires two-factor sign-in",
    }),
  ).toBeVisible();
  await expect(page.getByText("Two-factor sign-in").first()).toBeVisible();
  await expectNoSeriousA11yIssues(page, "two-factor required");
});
