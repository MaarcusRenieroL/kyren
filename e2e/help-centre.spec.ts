import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("a published article appears on the public help centre, a draft does not @tickets", async ({
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
  await expect(
    page.getByRole("button", { name: published, exact: true }),
  ).toBeVisible();

  await page.getByLabel("Article title").fill(draft);
  await page.getByLabel("Article text").fill("Not ready.");
  await page.getByRole("button", { name: "Add article" }).click();
  await expect(
    page.getByRole("button", { name: draft, exact: true }),
  ).toBeVisible();

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

test("an edited article keeps its earlier version, which can be restored @tickets", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "help-history",
    orgName: uniqueName("Help history org"),
  });

  await page.goto("/tickets");
  await page.getByText("Help articles").click();

  const title = uniqueName("Billing FAQ");

  await page.getByLabel("Article title").fill(title);
  await page.getByLabel("Article text").fill("Invoices go out on the 1st.");
  await page.getByRole("button", { name: "Add article" }).click();
  await expect(page.getByLabel("Article title")).toHaveValue("");
  await page.getByRole("button", { name: title, exact: true }).click();

  const history = page.getByRole("region", { name: "Earlier versions" });

  await expect(history.getByText("No earlier versions yet.")).toBeVisible();

  await page.getByLabel("Article text").fill("Invoices go out on the 5th.");
  await page.getByRole("button", { name: "Save changes" }).click();
  // Saving clears the form; open the article again once it has.
  await expect(page.getByRole("button", { name: "Add article" })).toBeVisible();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(history.getByText("Invoices go out on the 1st.")).toBeVisible();

  await history
    .getByRole("button", { name: /^Restore the version from/ })
    .click();
  await expect(page.getByLabel("Article text")).toHaveValue(
    "Invoices go out on the 1st.",
  );

  // The replaced text is kept too, so the restore can be undone.
  await expect(history.getByText("Invoices go out on the 5th.")).toBeVisible();
});

test("a trashed article leaves the help centre and comes back on restore @tickets", async ({
  page,
}) => {
  const orgName = uniqueName("Help trash org");

  await registerWithOrganization(page, { label: "help-trash", orgName });

  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const title = uniqueName("Refund policy");

  await page.goto("/tickets");
  await page.getByText("Help articles").click();
  await page.getByLabel("Article title").fill(title);
  await page.getByLabel("Article text").fill("Refunds within 30 days.");
  await page.getByLabel("Status").selectOption("published");
  await page.getByRole("button", { name: "Add article" }).click();
  await page
    .getByRole("button", { name: `Move ${title} to the trash` })
    .click();

  const trash = page.getByRole("region", { name: "Trashed articles" });

  await expect(trash.getByText(title)).toBeVisible();

  const visitor = await page.context().browser()!.newContext();
  const help = await visitor.newPage();

  await help.goto(`/help/${slug}`);
  await expect(help.getByText(title)).toHaveCount(0);

  await trash.getByRole("button", { name: `Restore ${title}` }).click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await help.reload();
  await expect(help.getByText(title)).toBeVisible();
  await visitor.close();
});

test("a saved reply is written once and inserted into a ticket reply with the customer's name @tickets", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "saved-reply",
    orgName: uniqueName("Saved reply org"),
  });

  await page.goto("/tickets");
  await page.getByText("Saved replies", { exact: true }).click();
  await page.getByLabel("Saved reply title").fill("Refund sent");
  await page
    .getByLabel("Saved reply text")
    .fill("Hi {customer}, your refund for {ticket} is sent.");
  await page.getByRole("button", { name: "Add saved reply" }).click();
  await expect(
    page.getByRole("list", { name: "Saved replies" }).getByText("Refund sent"),
  ).toBeVisible();

  const subject = uniqueName("Double charge");

  await page.getByRole("button", { name: "New ticket" }).first().click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Subject").fill(subject);
  await dialog.getByLabel("Requester", { exact: true }).fill("Rin");
  await dialog.getByRole("button", { name: "Create ticket" }).click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}/);

  await page
    .getByLabel("Insert a saved reply")
    .selectOption({ label: "Refund sent" });
  await expect(page.getByLabel("Reply", { exact: true })).toHaveValue(
    `Hi Rin, your refund for ${subject} is sent.`,
  );
});
