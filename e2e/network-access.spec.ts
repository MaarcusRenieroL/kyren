import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("an admin adds an allowed range, and cannot switch it on when it would lock them out @admin", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "network",
    orgName: uniqueName("Network org"),
  });

  await page.goto("/admin/network");
  await page.getByLabel("Address or range").fill("203.0.113.0/24");
  await page.getByLabel("Label").fill("Office");
  await page.getByRole("button", { name: "Add range" }).click();
  await expect(page.getByText("203.0.113.0/24")).toBeVisible();

  await page.getByRole("button", { name: "Switch on" }).click();
  await expect(page.getByText(/lock you out/i)).toBeVisible();
  await expect(page.getByText(/^Off:/)).toBeVisible();

  await page.getByLabel("Address or range").fill("nonsense");
  await page.getByRole("button", { name: "Add range" }).click();
  await expect(page.getByText("203.0.113.0/24")).toHaveCount(1);
});
