import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

test("someone schedules a meeting, finds the video link, and keeps shared notes", async ({
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
