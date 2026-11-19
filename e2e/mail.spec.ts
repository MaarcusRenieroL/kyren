import { expect, test } from "./fixtures";
import { uniqueName } from "./helpers";
import { acceptNextConfirm, orgWithMember } from "./people-helpers";

test("a message reaches only its recipient, and delete forever removes it for them only @mail", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "mail");
  const subject = uniqueName("Quarterly numbers");

  // The owner writes to the member.
  await page.goto("/mail");
  await page.getByRole("button", { name: "Compose" }).click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("To", { exact: true }).fill(team.memberName);
  await dialog.getByLabel("To", { exact: true }).press("Enter");
  await dialog.getByLabel("Subject").fill(subject);
  await dialog.getByLabel("Message").fill("Numbers are attached in the doc.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog).toBeHidden();

  // The member finds and reads it.
  const inbox = team.member;

  await inbox.goto("/mail");
  await inbox.getByRole("button", { name: new RegExp(subject) }).click();
  await expect(
    inbox.getByText("Numbers are attached in the doc."),
  ).toBeVisible();

  // Trash, then delete forever: gone from the member's mail.
  await inbox.getByRole("button", { name: "Move to trash" }).click();
  await inbox
    .getByRole("navigation", { name: "Mail folders" })
    .getByRole("button", { name: "Trash" })
    .click();
  await inbox.getByRole("button", { name: new RegExp(subject) }).click();
  acceptNextConfirm(inbox);
  await inbox.getByRole("button", { name: "Delete forever" }).click();
  await expect(
    inbox.getByRole("button", { name: new RegExp(subject) }),
  ).toHaveCount(0);

  // The owner's sent copy is untouched.
  await page
    .getByRole("navigation", { name: "Mail folders" })
    .getByRole("button", { name: "Sent" })
    .click();
  await expect(
    page.getByRole("button", { name: new RegExp(subject) }),
  ).toBeVisible();

  await team.close();
});

test("a file attached to a message opens for the recipient @mail", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "mail-files");
  const subject = uniqueName("Signed lease");

  await page.goto("/mail");
  await page.getByRole("button", { name: "Compose" }).click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("To", { exact: true }).fill(team.memberName);
  await dialog.getByLabel("To", { exact: true }).press("Enter");
  await dialog.getByLabel("Subject").fill(subject);
  await dialog.getByLabel("Message").fill("The lease is attached.");
  await dialog.getByLabel("Files to attach").setInputFiles({
    name: "lease.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Signed by both parties."),
  });
  await expect(
    dialog.getByRole("list", { name: "Attachments" }).getByText("lease.txt"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog).toBeHidden();

  const inbox = team.member;

  await inbox.goto("/mail");
  await inbox.getByRole("button", { name: new RegExp(subject) }).click();

  const link = inbox
    .getByRole("list", { name: "Attachments" })
    .getByRole("link", { name: /lease\.txt/ });

  await expect(link).toBeVisible();

  const href = await link.getAttribute("href");
  const response = await inbox.request.get(href!);

  expect(response.status()).toBe(200);
  expect(await response.text()).toBe("Signed by both parties.");

  await team.close();
});
