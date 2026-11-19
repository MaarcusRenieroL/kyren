import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("an admin turns on email to ticket and a posted email becomes a ticket @tickets", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "inbox",
    orgName: uniqueName("Inbox org"),
  });

  await page.goto("/tickets");
  await page.getByText("Email to ticket").click();
  await page.getByRole("button", { name: "Turn on" }).click();

  const address = await page
    .locator("p.font-mono")
    .filter({ hasText: "/api/inbound/tickets/" })
    .textContent();

  expect(address).toMatch(/\/api\/inbound\/tickets\/[0-9a-f]{48}$/);

  const subject = uniqueName("Cannot log in");
  const email = {
    from: "Rin <rin@customer.example>",
    subject,
    text: "Password reset does not arrive.",
    messageId: `<${subject}@customer.example>`,
  };
  const response = await page.request.post(address!.trim(), { data: email });

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "created" });

  // The same delivery again is not a second ticket.
  const again = await page.request.post(address!.trim(), { data: email });

  expect(await again.json()).toMatchObject({ status: "duplicate" });

  // Nobody owns it yet, so it waits in Unassigned.
  await page.reload();
  await page.getByRole("tab", { name: /^Unassigned/ }).click();
  await expect(page.getByText(subject)).toHaveCount(1);

  const wrong = await page.request.post(
    "/api/inbound/tickets/" + "0".repeat(48),
    { data: { from: "a@b.example", subject: "x", text: "y" } },
  );

  expect(wrong.status()).toBe(404);
});
