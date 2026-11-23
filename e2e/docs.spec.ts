import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  createDocViaUi,
  query,
  registerWithOrganization,
  uniqueName,
} from "./helpers";
import { acceptNextConfirm, orgWithMember } from "./people-helpers";

async function write(page: Page, text: string) {
  const body = page.getByRole("textbox", { name: "Doc body" });

  await expect(body).toHaveAttribute("contenteditable", "true");
  await body.click();
  await body.press("ControlOrMeta+a");
  await body.pressSequentially(text);
  await expect(page.getByRole("status")).toContainText("Saved");
}

const docContent = async (title: string) =>
  (
    await query<{ content: string }>(
      `select content from doc where title = $1`,
      [title],
    )
  )[0]!.content;

async function openComments(page: Page) {
  const show = page.getByRole("button", { name: "Show comments" });

  if (await show.isVisible()) {
    await show.click();
  }

  return page.getByRole("complementary", { name: "Comments" });
}

test("only the author edits a comment; the author or a doc editor deletes it @docs", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "doc-comments");
  const title = uniqueName("Spec");

  await createDocViaUi(page, title);
  const docUrl = page.url();

  let comments = await openComments(page);

  await comments.getByLabel("Add a comment").fill("Intro needs numbers");
  await comments.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(comments.getByText("Intro needs numbers")).toBeVisible();

  await comments.getByRole("button", { name: "Edit", exact: true }).click();
  await comments.getByLabel("Edit comment").fill("Intro needs 2026 numbers");
  await comments.getByRole("button", { name: "Save", exact: true }).click();
  await expect(comments.getByText("Intro needs 2026 numbers")).toBeVisible();

  // A colleague can read it but cannot put words in the author's mouth.
  await team.member.goto(docUrl);
  const theirs = await openComments(team.member);

  await expect(theirs.getByText("Intro needs 2026 numbers")).toBeVisible();
  await expect(
    theirs.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  // Members may edit every doc here, so they may moderate: Delete is offered.
  await expect(
    theirs.getByRole("button", { name: /^Delete comment by/ }),
  ).toBeVisible();

  await page.reload();
  comments = await openComments(page);
  acceptNextConfirm(page);
  await comments.getByRole("button", { name: /^Delete comment by/ }).click();
  await expect(comments.getByText("Intro needs 2026 numbers")).toHaveCount(0);
  await expect(comments.getByText("No open comments")).toBeVisible();

  await team.close();
});

test("an earlier version comes back from the history panel @docs", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "doc-history",
    orgName: uniqueName("Doc history org"),
  });

  const title = uniqueName("Plan");

  await createDocViaUi(page, title);
  await write(page, "The first plan");
  await expect.poll(() => docContent(title)).toContain("The first plan");

  // The first version is from earlier in the day; the next save is its own.
  await query(
    `update "docVersion" set "createdAt" = now() - interval '1 hour'
       where "docId" = (select id from doc where title = $1)`,
    [title],
  );
  await write(page, "A plan nobody liked");
  await expect.poll(() => docContent(title)).toContain("nobody liked");

  await page.getByRole("button", { name: "Show version history" }).click();

  const history = page.getByRole("complementary", {
    name: "Document version history",
  });

  await expect(history.getByText("A plan nobody liked")).toBeVisible();
  await history.getByRole("button", { name: "Restore" }).click();

  await expect(page.getByRole("textbox", { name: "Doc body" })).toContainText(
    "The first plan",
  );
  await expect.poll(() => docContent(title)).toContain("The first plan");
  await expect.poll(() => docContent(title)).not.toContain("nobody liked");
});

test("a colleague replies in the thread, and resolving it hides the whole thread @docs", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "doc-threads");
  const title = uniqueName("Threads");

  await createDocViaUi(page, title);
  const docUrl = page.url();

  let comments = await openComments(page);

  await comments.getByLabel("Add a comment").fill("Is the launch date right?");
  await comments.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(comments.getByText("Is the launch date right?")).toBeVisible();

  await team.member.goto(docUrl);
  const theirs = await openComments(team.member);

  await theirs.getByRole("button", { name: /^Reply to / }).click();
  await theirs.getByLabel("Reply", { exact: true }).fill("It moved to Friday.");
  await theirs.getByRole("button", { name: "Send reply" }).click();
  await expect(theirs.getByText("It moved to Friday.")).toBeVisible();
  // A reply belongs to its thread: still one open, and no Resolve of its own.
  await expect(theirs.getByText("1 open")).toBeVisible();
  await expect(theirs.getByRole("button", { name: "Resolve" })).toHaveCount(1);

  await page.reload();
  comments = await openComments(page);
  await expect(comments.getByText("It moved to Friday.")).toBeVisible();
  await comments.getByRole("button", { name: "Resolve" }).click();
  await expect(comments.getByText("It moved to Friday.")).toHaveCount(0);
  await expect(comments.getByText("No open comments")).toBeVisible();

  await team.close();
});

test("a public link lets anyone read the doc until it is turned off @docs", async ({
  page,
  browser,
}) => {
  await registerWithOrganization(page, {
    label: "doc-share",
    orgName: uniqueName("Doc share org"),
  });

  const title = uniqueName("Public plan");

  await createDocViaUi(page, title);
  await write(page, "Shared with the whole world");

  await page.getByRole("button", { name: "Share", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Share this doc" });

  await dialog
    .getByRole("checkbox", { name: "Anyone with the link can read" })
    .check();

  const link = dialog.getByLabel("Public link");

  await expect(link).toHaveValue(/\/share\/doc\/[A-Za-z0-9_-]{32}$/);
  const url = await link.inputValue();

  // Signed out, the link shows the doc and nothing to edit.
  const visitor = await browser.newContext();
  const reader = await visitor.newPage();
  const response = await reader.goto(url);

  expect(response?.status()).toBe(200);
  await expect(reader.getByRole("heading", { name: title })).toBeVisible();
  await expect(reader.getByText("Shared with the whole world")).toBeVisible();
  await expect(reader.getByRole("textbox")).toHaveCount(0);

  await dialog
    .getByRole("checkbox", { name: "Anyone with the link can read" })
    .uncheck();
  await expect(dialog.getByLabel("Public link")).toHaveCount(0);

  // Once the change lands, the same link is gone.
  await expect.poll(async () => (await reader.goto(url))?.status()).toBe(404);
  await visitor.close();
});
