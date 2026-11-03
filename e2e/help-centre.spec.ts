import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("a published article appears on the public help centre, a draft does not", async ({
  page,
}) => {
  const orgName = uniqueName("Help org");

  await registerWithOrganization(page, { label: "help", orgName });

  const org = { slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-") };

  await page.goto("/tickets");
  await page.getByText("Help articles").click();

  const published = uniqueName("Reset password");
  const draft = uniqueName("Secret draft");

  await page.getByLabel("Article title").fill(published);
  await page.getByLabel("Article text").fill("Open Settings > Security.");
  await page.getByLabel("Status").selectOption("published");
  await page.getByRole("button", { name: "Add article" }).click();
  await expect(page.getByRole("button", { name: published })).toBeVisible();

  await page.getByLabel("Article title").fill(draft);
  await page.getByLabel("Article text").fill("Not ready.");
  await page.getByRole("button", { name: "Add article" }).click();
  await expect(page.getByRole("button", { name: draft })).toBeVisible();

  // Anyone, signed out, sees the published one and only that one.
  const visitor = await page.context().browser()!.newContext();
  const help = await visitor.newPage();

  await help.goto(`/help/${org.slug}`);
  await expect(help.getByText(published)).toBeVisible();
  await expect(help.getByText(draft)).toHaveCount(0);
  await help.getByText(published).click();
  await expect(help.getByText("Open Settings > Security.")).toBeVisible();

  const missing = await help.goto(`/help/${org.slug}/secret-draft`);

  expect(missing!.status()).toBe(404);
  await visitor.close();
});
