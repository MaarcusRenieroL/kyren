import { expect, test } from "./fixtures";
import { query, trpcMutation } from "./helpers";
import { orgWithMember } from "./people-helpers";

test("a member sees their annual leave balance and can't request past it @hr", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "leave-balance");
  const [member] = await query<{ id: string }>(
    `select m.id from member m join "user" u on u.id = m."userId"
      join organization o on o.id = m."organizationId"
      where u.email = $1 and o.name = $2`,
    [team.memberEmail, team.orgName],
  );

  await trpcMutation(page, "hr.create", {
    name: team.memberName,
    email: null,
    jobTitle: "Engineer",
    department: null,
    location: null,
    status: "active",
    startDate: null,
    endDate: null,
    managerId: null,
    memberId: member!.id,
    annualLeaveDays: 2,
  });

  await team.member.goto("/hr/leave");
  await expect(team.member.getByText("2 of 2 days")).toBeVisible();

  // Three weekdays next year is more than the two allowed.
  const year = new Date().getUTCFullYear() + 1;
  const refused = await team.member.evaluate(async (y) => {
    const response = await fetch("/api/trpc/hr.leaveRequest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        json: {
          type: "annual",
          startDate: `${y}-03-01`,
          endDate: `${y}-03-31`,
          note: null,
        },
      }),
    });

    return (await response.text()).includes("annual leave left");
  }, year);

  expect(refused).toBe(true);

  // HR lets two unused days carry over; last year none were used, so both do.
  await page.goto("/hr");
  await page.getByRole("button", { name: `Edit ${team.memberName}` }).click();

  const dialog = page.getByRole("dialog", { name: "Edit person" });

  await dialog
    .getByLabel("Unused days that carry into next year (empty: none)")
    .fill("2");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);

  await team.member.reload();
  await expect(team.member.getByText("4 of 4 days")).toBeVisible();
  await expect(
    team.member.getByText(`(2 carried over from ${year - 2})`),
  ).toBeVisible();

  // Switched to monthly accrual: only this year's months so far are earned.
  await page.getByRole("button", { name: `Edit ${team.memberName}` }).click();
  await dialog
    .getByLabel("Annual leave is earned")
    .selectOption({ label: "A twelfth each month" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);

  const month = new Date().getUTCMonth() + 1;
  const earned = Math.floor(((2 * month) / 12) * 2) / 2;

  await team.member.reload();
  await expect(
    team.member.getByText(`${earned + 2} of ${earned + 2} days`),
  ).toBeVisible();
  await expect(
    team.member.getByText("(earned so far of 2 this year)"),
  ).toBeVisible();

  await team.close();
});
