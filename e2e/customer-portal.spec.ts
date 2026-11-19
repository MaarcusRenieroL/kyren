import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("a customer follows and answers their ticket through a private link, signed out @tickets", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "portal",
    orgName: uniqueName("Portal org"),
  });

  // A ticket arrives by email.
  await page.goto("/tickets");
  await page.getByText("Email to ticket").click();
  await page.getByRole("button", { name: "Turn on" }).click();

  const address = await page
    .locator("p.font-mono")
    .filter({ hasText: "/api/inbound/tickets/" })
    .textContent();
  const subject = uniqueName("Refund please");

  await page.request.post(address!.trim(), {
    data: {
      from: "Rin <rin@customer.example>",
      subject,
      text: "I was charged twice.",
    },
  });

  // The agent opens it and finds the customer's link.
  await page.reload();
  await page.getByRole("tab", { name: /^Unassigned/ }).click();
  await page.getByText(subject).click();

  const link = await page
    .locator("code")
    .filter({ hasText: "/support/" })
    .textContent();

  expect(link).toMatch(/\/support\/[0-9a-f]{64}$/);

  // The customer has no account and no cookies.
  const customer = await page.context().browser()!.newContext();
  const portal = await customer.newPage();

  await portal.goto(link!.trim());
  await expect(portal.getByRole("heading", { name: subject })).toBeVisible();
  await expect(portal.getByText("I was charged twice.")).toBeVisible();

  await portal.getByLabel("Reply").fill("Any update?");
  await portal.getByRole("button", { name: "Send reply" }).click();
  await expect(portal.getByText("Any update?")).toBeVisible();

  // A wrong link reveals nothing.
  await portal.goto("/support/" + "0".repeat(64));
  await expect(portal.getByText("We can't find that request")).toBeVisible();
  await customer.close();

  // The agent sees the answer, marked as coming from the customer by email.
  await page.reload();
  await expect(page.getByText("Any update?")).toBeVisible();
});
