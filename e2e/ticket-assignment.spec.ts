import { expect, test } from "./fixtures";
import { query } from "./helpers";
import { orgWithMember } from "./people-helpers";

test("an admin turns on automatic assignment for a teammate @tickets", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "ticket-assign");

  await page.goto("/tickets");

  // The settings panel is a disclosure (a "group"); scope to it, since the
  // email panel has a "Turn on" button too.
  const panel = page
    .getByRole("group")
    .filter({ hasText: "Automatic assignment" });

  await panel.getByText("Automatic assignment · off").click();
  await panel.getByRole("checkbox", { name: team.memberName }).check();
  await panel
    .getByRole("radio", { name: "Whoever has the fewest open tickets" })
    .check();
  await panel.getByRole("button", { name: "Turn on" }).click();
  await expect(panel.getByText("Automatic assignment · on")).toBeVisible();

  const [rule] = await query<{ enabled: boolean; count: number; mode: string }>(
    `select r.enabled, cardinality(r."memberIds") as count, r.mode
       from "ticketAssignmentRule" r join organization o on o.id = r."organizationId"
      where o.name = $1`,
    [team.orgName],
  );

  expect(rule).toEqual({ enabled: true, count: 1, mode: "least_open" });

  // The choice is still selected after a reload.
  await page.reload();
  await panel.getByText("Automatic assignment · on").click();
  await expect(
    panel.getByRole("radio", { name: "Whoever has the fewest open tickets" }),
  ).toBeChecked();

  await team.close();
});
