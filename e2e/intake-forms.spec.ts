import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("a signed-out visitor fills in a public form and an agent finds the ticket @tickets", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "intake",
    orgName: uniqueName("Intake org"),
  });

  await page.goto("/tickets");
  await page.getByText("Intake forms").click();

  const formName = uniqueName("Report a problem");

  await page.getByLabel("Form name").fill(formName);
  await page.getByRole("button", { name: "Create form" }).click();
  await expect(page.getByRole("button", { name: formName })).toBeVisible();

  const link = await page
    .locator("p.font-mono")
    .filter({ hasText: "/forms/" })
    .textContent();

  expect(link).toMatch(/\/forms\/[0-9a-f]{48}$/);

  const visitor = await page.context().browser()!.newContext();
  const form = await visitor.newPage();

  await form.goto(link!.trim());
  await expect(form.getByRole("heading", { name: formName })).toBeVisible();

  // Required answers are checked.
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Required.").first()).toBeVisible();

  const topic = uniqueName("Printer fire");

  await form.getByLabel(/Your name/).fill("Rin Customer");
  await form.getByLabel(/Your email/).fill("rin@customer.example");
  await form.getByLabel(/What is this about/).fill(topic);
  await form.getByLabel(/Details/).fill("It is smoking.");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Thank you")).toBeVisible();

  // A wrong link reveals nothing.
  await form.goto("/forms/" + "0".repeat(48));
  await expect(form.getByText("We can't find that form")).toBeVisible();
  await visitor.close();

  await page.reload();
  await page.getByRole("tab", { name: /^Unassigned/ }).click();
  await expect(page.getByText(new RegExp(topic))).toBeVisible();
});
