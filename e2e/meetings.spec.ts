import { expect, test } from "./fixtures";

import {
  createProjectViaUi,
  query,
  registerWithOrganization,
  uniqueName,
} from "./helpers";

test("someone schedules a meeting, finds the video link, and keeps shared notes @calendar", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "meet",
    orgName: uniqueName("Meet org"),
  });

  await page.goto("/calendar/meetings");
  await expect(page.getByText("No upcoming meetings")).toBeVisible();

  const title = uniqueName("Weekly sync");

  await page.getByRole("button", { name: "Schedule a meeting" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Agenda").fill("Review the roadmap");
  await page.getByRole("button", { name: "Schedule", exact: true }).click();

  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Review the roadmap")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Join video call" }),
  ).toHaveAttribute("href", /\/zentro-[0-9a-f]{24}$/);

  await page.getByLabel("Meeting notes").fill("Decision: ship on Friday");
  await page.getByRole("button", { name: "Save notes" }).click();
  await page.reload();
  await expect(page.getByLabel("Meeting notes")).toHaveValue(
    "Decision: ship on Friday",
  );

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Cancel meeting" }).click();
  await expect(page.getByText(/Canceled/).first()).toBeVisible();
});

test("the recap's action items become tasks in a chosen project @calendar", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "meet-actions",
    orgName: uniqueName("Meet actions org"),
  });

  const project = uniqueName("Launch");

  await createProjectViaUi(page, project);
  await page.goto("/calendar/meetings");

  const title = uniqueName("Launch sync");

  await page.getByRole("button", { name: "Schedule a meeting" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // The AI recap needs an API key, so the test writes one directly.
  await query(`update meeting set summary = $1 where title = $2`, [
    "We picked a date.\n\nAction items:\n- Write the release note\n- Book the demo room",
    title,
  ]);
  await page.reload();

  await page
    .getByLabel("Project for the tasks")
    .selectOption({ label: project });
  await page.getByRole("button", { name: "Create 2 tasks" }).click();
  await expect(page.getByText(/^Created [A-Z0-9]+-\d+/)).toBeVisible();

  const tasks = await query<{ name: string }>(
    `select t.name from task t join project p on p.id = t."projectId"
      where p.name = $1 order by t.name`,
    [project],
  );

  expect(tasks.map((task) => task.name)).toEqual([
    "Book the demo room",
    "Write the release note",
  ]);
});
