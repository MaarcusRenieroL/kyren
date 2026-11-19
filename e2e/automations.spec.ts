import { expect, test } from "./fixtures";
import { query, trpcMutation, uniqueName } from "./helpers";
import { acceptNextConfirm, orgWithMember } from "./people-helpers";

const rulesIn = async (orgName: string) =>
  query<{ name: string; enabled: boolean; projectId: string | null }>(
    `select a.name, a.enabled, a."projectId" from automation a
       join organization o on o.id = a."organizationId" where o.name = $1`,
    [orgName],
  );

test("an admin creates, pauses and deletes a project rule; members get no presets @tasks", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "automations");
  const project = await trpcMutation<{ id: string }>(
    page,
    "project.createProject",
    { name: "Rules project", slug: "rules-project", description: "" },
  );
  const ruleName = uniqueName("Raise new work");

  await page.goto("/settings/organization/automations");
  await expect(
    page.getByRole("heading", { name: "Automations" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New automation" }).click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Rule name").fill(ruleName);
  await dialog.getByLabel("When").selectOption("task.created");
  await dialog.getByLabel("Then").selectOption("set_priority");
  await dialog.getByLabel("Priority to set").selectOption("high");
  await dialog.getByLabel("Project this rule runs on").selectOption(project.id);
  await dialog.getByRole("button", { name: "Create rule" }).click();
  await expect(dialog).toBeHidden();

  const toggle = page.getByRole("button", { name: `Run ${ruleName}` });

  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => rulesIn(team.orgName))
    .toEqual([{ name: ruleName, enabled: true, projectId: project.id }]);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(async () => (await rulesIn(team.orgName))[0]?.enabled)
    .toBe(false);

  // Deleting asks first; dismissing keeps the rule.
  page.once("dialog", (confirm) => void confirm.dismiss());
  await page.getByRole("button", { name: `Delete ${ruleName}` }).click();
  await expect(
    page.getByRole("button", { name: `Delete ${ruleName}` }),
  ).toBeVisible();

  acceptNextConfirm(page);
  await page.getByRole("button", { name: `Delete ${ruleName}` }).click();
  await expect.poll(async () => (await rulesIn(team.orgName)).length).toBe(0);

  // Org-wide presets are for admins only.
  await team.member.goto("/settings/organization/automations");
  await expect(
    team.member.getByRole("heading", { name: "Automations" }),
  ).toBeVisible();
  await expect(
    team.member.getByRole("button", { name: "Add the preset automations" }),
  ).toHaveCount(0);
  await expect(
    team.member.getByText("Rules for every project are set up by an admin."),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Add the preset automations" })
    .first()
    .click();
  await expect.poll(async () => (await rulesIn(team.orgName)).length).toBe(4);

  await team.close();
});
