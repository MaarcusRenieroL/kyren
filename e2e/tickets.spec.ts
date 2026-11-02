import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

import {
  createProjectViaUi,
  createTaskViaUi,
  query,
  registerWithOrganization,
  uniqueName,
} from "./helpers";
import {
  acceptNextConfirm,
  expectNoSeriousA11yIssues,
  orgWithMember,
} from "./people-helpers";

async function newTicket(
  page: Page,
  fields: { subject: string; requester: string; description?: string },
) {
  await page.goto("/tickets");
  await page.getByRole("button", { name: "New ticket" }).first().click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Subject").fill(fields.subject);
  await dialog.getByLabel("Requester").fill(fields.requester);

  if (fields.description) {
    await dialog.getByLabel("What happened").fill(fields.description);
  }

  await dialog.getByRole("button", { name: "Create ticket" }).click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}/);
  await expect(
    page.getByRole("heading", { name: fields.subject }),
  ).toBeVisible();
}

test("the queue is empty at first, and new tickets are numbered SUP-1, SUP-2", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "tkempty",
    orgName: uniqueName("Tickets empty"),
  });

  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
  await expect(page.getByText("All caught up")).toBeVisible();

  await newTicket(page, {
    subject: uniqueName("Card declined"),
    requester: "Acme Logistics",
    description: "3-D Secure retry fails.",
  });
  await expect(page.getByText("SUP-1", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("3-D Secure retry fails.")).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("open");
  await expect(page.getByLabel("Assignee")).toHaveValue("");

  await newTicket(page, {
    subject: uniqueName("Invoice copy"),
    requester: "Globex",
  });
  await expect(page.getByText("SUP-2", { exact: true }).first()).toBeVisible();
});

test("the dialog reports a missing subject, requester and a bad email", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "tkvalid",
    orgName: uniqueName("Tickets valid"),
  });

  await page.goto("/tickets");
  await page.getByRole("button", { name: "New ticket" }).first().click();

  const dialog = page.getByRole("dialog");

  // Nothing is flagged before a submit.
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Create ticket" }).click();
  await expect(dialog.getByRole("alert")).toContainText("subject");

  await dialog.getByLabel("Subject").fill("Something broke");
  await dialog.getByRole("button", { name: "Create ticket" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Who is asking");

  await dialog.getByLabel("Requester").fill("Zed");
  await dialog.getByLabel("Email (optional)").fill("zed@nowhere");
  await dialog.getByRole("button", { name: "Create ticket" }).click();
  await expect(dialog.getByRole("alert")).toContainText("email");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
});

test("views, counts, search and assignment move tickets between queues", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "tkviews",
    orgName: uniqueName("Tickets views"),
  });

  const alpha = uniqueName("Alpha outage");
  const beta = uniqueName("Beta billing");

  await newTicket(page, { subject: alpha, requester: "Acme" });
  await newTicket(page, { subject: beta, requester: "Globex" });

  await page.goto("/tickets");
  await page.getByRole("tab", { name: /^Unassigned/ }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(alpha) }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(beta) }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /^Unassigned\s*2/ }),
  ).toBeVisible();

  // Search narrows the list.
  await page.getByLabel("Search tickets").fill("Beta");
  await expect(page.getByRole("link", { name: new RegExp(alpha) })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: new RegExp(beta) }),
  ).toBeVisible();
  await page.getByLabel("Search tickets").fill("zzz-nothing");
  await expect(page.getByText("Nothing matches")).toBeVisible();
  await page.getByLabel("Search tickets").fill("");

  // Assign Alpha to the signed-in owner: it leaves Unassigned, enters My tickets.
  await page.getByRole("link", { name: new RegExp(alpha) }).click();
  await page.getByLabel("Assignee").selectOption({ index: 1 });
  await expect(page.getByLabel("Assignee")).not.toHaveValue("");

  await page.goto("/tickets");
  await expect(
    page.getByRole("tab", { name: /^My tickets\s*1/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /^Unassigned\s*1/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(alpha) }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(beta) })).toHaveCount(
    0,
  );

  // Priority and status changes show in the queue.
  await page.getByRole("link", { name: new RegExp(alpha) }).click();
  await page.getByLabel("Priority").selectOption("urgent");
  await expect(page.getByLabel("Priority")).toHaveValue("urgent");
  await page.getByLabel("Status").selectOption("spam");
  await expect(page.getByLabel("Status")).toHaveValue("spam");

  await page.goto("/tickets");
  await page.getByRole("tab", { name: /^Spam/ }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(alpha) }),
  ).toBeVisible();
  await expect(page.getByText("Urgent")).toBeVisible();
});

test("replies park a ticket as pending, notes stay internal, resolving stamps it", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "tkreply",
    orgName: uniqueName("Tickets reply"),
  });

  const subject = uniqueName("Refund timing");

  await newTicket(page, { subject, requester: "Initech" });

  // The send button waits for text.
  await expect(page.getByRole("button", { name: "Send reply" })).toBeDisabled();

  await page.getByRole("radio", { name: "Internal note" }).click();
  await page
    .getByRole("textbox", { name: "Internal note" })
    .fill("Check with finance");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Check with finance")).toBeVisible();
  await expect(page.getByText(/internal note/).first()).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("open");

  await page.getByRole("radio", { name: "Reply", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Reply", exact: true })
    .fill("Refunds take 3 to 5 days.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Refunds take 3 to 5 days.")).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("pending");

  await page.getByLabel("Status").selectOption("resolved");
  await expect(page.getByLabel("Status")).toHaveValue("resolved");

  const [row] = await query<{ resolvedAt: Date | null }>(
    `select "resolvedAt" from ticket where subject = $1`,
    [subject],
  );

  expect(row!.resolvedAt).not.toBeNull();

  // The Resolved view lists it; reopening clears the stamp.
  await page.goto("/tickets");
  await page.getByRole("tab", { name: /^Resolved/ }).click();
  await page.getByRole("link", { name: new RegExp(subject) }).click();
  await page.getByLabel("Status").selectOption("open");
  await expect(page.getByLabel("Status")).toHaveValue("open");

  await expect
    .poll(async () => {
      const [reopened] = await query<{ resolvedAt: Date | null }>(
        `select "resolvedAt" from ticket where subject = $1`,
        [subject],
      );

      return reopened!.resolvedAt;
    })
    .toBeNull();
});

test("a ticket links to a task by key and unlinks again", async ({ page }) => {
  await registerWithOrganization(page, {
    label: "tklink",
    orgName: uniqueName("Tickets link"),
  });
  await createProjectViaUi(page, uniqueName("Support project"));

  const taskName = uniqueName("Fix retry");

  await createTaskViaUi(page, taskName);

  const [task] = await query<{ key: string }>(
    `select key from task where name = $1`,
    [taskName],
  );

  await newTicket(page, {
    subject: uniqueName("Linked ticket"),
    requester: "Acme",
  });

  await page.getByLabel("Task key").fill("NOPE-999");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(page.getByText(/No task with the key NOPE-999/)).toBeVisible();

  await page.getByLabel("Task key").fill(task!.key.toLowerCase());
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(page.getByText(taskName)).toBeVisible();

  await page.reload();
  await expect(page.getByText(taskName)).toBeVisible();

  await page.getByRole("button", { name: "Unlink" }).click();
  await expect(page.getByLabel("Task key")).toBeVisible();
});

test("deleting a ticket asks first, then removes it", async ({ page }) => {
  await registerWithOrganization(page, {
    label: "tkdel",
    orgName: uniqueName("Tickets delete"),
  });

  const subject = uniqueName("Delete me");

  await newTicket(page, { subject, requester: "Acme" });

  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}/);

  acceptNextConfirm(page);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  const rows = await query(`select 1 from ticket where subject = $1`, [
    subject,
  ]);

  expect(rows).toHaveLength(0);
});

test("an unknown ticket id shows a not-found state", async ({ page }) => {
  await registerWithOrganization(page, {
    label: "tk404",
    orgName: uniqueName("Tickets 404"),
  });

  await page.goto("/tickets/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("Ticket not found")).toBeVisible();
  await page.getByRole("link", { name: "Back to tickets" }).click();
  await expect(page).toHaveURL(/\/tickets$/);
});

test("members work tickets but cannot delete them, and tickets stay in their organization", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "tkperm");
  const subject = uniqueName("Member ticket");

  await newTicket(team.member, { subject, requester: "Customer" });
  await team.member
    .getByRole("textbox", { name: "Reply", exact: true })
    .fill("On it");
  await team.member.getByRole("button", { name: "Send reply" }).click();
  await expect(team.member.getByLabel("Status")).toHaveValue("pending");
  await expect(
    team.member.getByRole("button", { name: "Delete", exact: true }),
  ).toHaveCount(0);

  // The owner sees the member's ticket.
  await page.goto("/tickets");
  await page.getByRole("tab", { name: /^Pending/ }).click();
  await page.getByRole("link", { name: new RegExp(subject) }).click();
  await expect(page.getByText("On it")).toBeVisible();

  // Another organization cannot open it.
  const [ticket] = await query<{ id: string }>(
    `select id from ticket where subject = $1`,
    [subject],
  );
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();

  await registerWithOrganization(strangerPage, {
    label: "tkstranger",
    orgName: uniqueName("Other org"),
  });
  await strangerPage.goto(`/tickets/${ticket!.id}`);
  await expect(strangerPage.getByText("Ticket not found")).toBeVisible();
  await stranger.close();

  acceptNextConfirm(page);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  await team.close();
});

test("ticket changes are audited and the module can be switched off", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "tkmod",
    orgName: uniqueName("Tickets module"),
  });

  const subject = uniqueName("Audited ticket");

  await newTicket(page, { subject, requester: "Acme" });
  await page.getByLabel("Priority").selectOption("high");
  await expect(page.getByLabel("Priority")).toHaveValue("high");

  await expect
    .poll(async () => {
      const rows = await query<{ action: string }>(
        `select action from "activityEvent" where "targetLabel" like $1 order by "createdAt"`,
        [`%${subject}`],
      );

      return rows.map((row) => row.action);
    })
    .toEqual(["ticket.created", "ticket.updated"]);

  await page.goto("/settings/organization/modules");
  await page.getByRole("switch", { name: "Tickets module" }).click();
  await expect(
    page.getByRole("switch", { name: "Tickets module" }),
  ).not.toBeChecked();

  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/module-disabled\?module=tickets/);
});

test("the queue and a ticket page pass accessibility checks and fit a phone", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "tka11y",
    orgName: uniqueName("Tickets a11y"),
  });

  const subject = uniqueName("A11y ticket");

  await newTicket(page, { subject, requester: "Acme" });
  await expectNoSeriousA11yIssues(page, "ticket page");

  await page.goto("/tickets");
  await page.getByRole("tab", { name: /^Unassigned/ }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(subject) }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(page, "ticket queue");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(overflow, "no horizontal page scroll on a phone").toBe(false);
});

test("an empty queue offers one New ticket button, in the empty state", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "tkempty",
    orgName: uniqueName("Tickets empty"),
  });

  await page.goto("/tickets");
  await expect(page.getByText("All caught up")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("button", { name: "New ticket" }),
  ).toHaveCount(1);
});
