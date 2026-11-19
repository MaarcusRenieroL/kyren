import { expect, test } from "./fixtures";
import { query, registerWithOrganization, uniqueName } from "./helpers";

test("a weekly event shows every week and is stored once @calendar", async ({
  page,
}) => {
  const orgName = uniqueName("Repeat org");

  await registerWithOrganization(page, { label: "repeat", orgName });
  await page.goto("/calendar");

  const title = uniqueName("Stand-up");

  await page.getByRole("button", { name: "New event" }).first().click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Repeats").selectOption("weekly");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  // This month shows it more than once; a whole next month, every week.
  const shown = () => page.getByRole("main").getByText(title).count();

  await expect.poll(shown).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Next" }).click();
  await expect.poll(shown).toBeGreaterThanOrEqual(4);

  const [row] = await query<{ count: number; repeat: string }>(
    `select count(*)::int as count, max(e.repeat) as repeat
       from "calendarEvent" e join organization o on o.id = e."organizationId"
      where o.name = $1 and e.title = $2`,
    [orgName, title],
  );

  expect(row).toEqual({ count: 1, repeat: "weekly" });
});

test("one event in a series can be deleted or changed on its own @calendar", async ({
  page,
}) => {
  const orgName = uniqueName("Repeat one org");

  await registerWithOrganization(page, { label: "repeat-one", orgName });
  await page.goto("/calendar");

  const title = uniqueName("Review");
  const moved = uniqueName("Moved review");

  await page.getByRole("button", { name: "New event" }).first().click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Repeats").selectOption("weekly");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  // A whole month ahead holds four or five of them.
  await page.getByRole("button", { name: "Next" }).click();

  const main = page.getByRole("main");
  const shown = () => main.getByText(title).count();

  await expect.poll(shown).toBeGreaterThanOrEqual(4);
  const before = await shown();

  await main.getByText(title).first().click();
  await dialog.getByRole("button", { name: "Delete only this event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(shown).toBe(before - 1);

  await main.getByText(title).first().click();
  await dialog.getByRole("button", { name: "Edit only this event" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Edit this event only" }),
  ).toBeVisible();
  // A single event: it no longer offers to repeat.
  await expect(dialog.getByLabel("Repeats")).toHaveCount(0);
  await dialog.getByLabel("Title").fill(moved);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(shown).toBe(before - 2);
  await expect(main.getByText(moved)).toHaveCount(1);

  const rows = await query<{ repeat: string | null; skipped: string[] }>(
    `select e.repeat, e.skipped
       from "calendarEvent" e join organization o on o.id = e."organizationId"
      where o.name = $1 order by e."createdAt"`,
    [orgName],
  );

  expect(rows.map((row) => [row.repeat, row.skipped.length])).toEqual([
    ["weekly", 2],
    [null, 0],
  ]);
});
