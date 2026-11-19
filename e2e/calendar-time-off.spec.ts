import { expect, test } from "./fixtures";
import { query, trpcMutation } from "./helpers";
import { orgWithMember } from "./people-helpers";

const day = (date: Date) => date.toISOString().slice(0, 10);

test("approved time off shows on the calendar and opens HR @calendar @hr", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "time-off");
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
  });

  // A week from today always holds weekdays and starts in this month's view.
  const start = new Date();
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const leave = await trpcMutation<{ id: string }>(
    team.member,
    "hr.leaveRequest",
    { type: "annual", startDate: day(start), endDate: day(end), note: null },
  );

  await trpcMutation(page, "hr.leaveDecide", {
    id: leave.id,
    decision: "approved",
  });

  await page.goto("/calendar");

  const entry = page
    .getByRole("main")
    .getByRole("button", { name: `Out (annual): ${team.memberName}` })
    .first();

  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page).toHaveURL(/\/hr$/);

  await team.close();
});
