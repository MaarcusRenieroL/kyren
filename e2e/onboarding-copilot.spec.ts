import { expect, test } from "./fixtures";
import {
  createProjectViaUi,
  registerWithOrganization,
  uniqueName,
} from "./helpers";

test.describe("Onboarding, Stepper Walkthrough, and AI Copilot @dashboard", () => {
  test("starter checklist, interactive tour stepper, and ai copilot sheet work seamlessly @dashboard", async ({
    page,
  }) => {
    const orgName = uniqueName("Acme Onboarding");
    await registerWithOrganization(page, {
      label: "onboard-user",
      orgName,
    });

    // 1. The starter checklist follows what the workspace really has.
    await page.goto("/dashboard");
    const checklistCard = page.getByRole("region", {
      name: "Getting started",
    });
    await expect(checklistCard).toBeVisible();
    await expect(checklistCard.getByText("0 of 5 done")).toBeVisible();

    // Steps can't be ticked by hand; making a project completes that step.
    await expect(
      checklistCard.getByRole("button", { name: /Mark .* as complete/i }),
    ).toHaveCount(0);
    await createProjectViaUi(page, uniqueName("Onboarding project"));
    await page.goto("/dashboard");
    await expect(checklistCard.getByText("1 of 5 done")).toBeVisible();
    await expect(
      checklistCard.getByRole("link", { name: "Go to Projects" }),
    ).toHaveCount(0);

    // 2. Interactive Stepper Walkthrough from TopBar
    const tourBtn = page.getByRole("button", { name: "Take a tour" });
    await expect(tourBtn).toBeVisible();
    await tourBtn.click();

    const tourDialog = page.getByRole("dialog");
    await expect(tourDialog).toBeVisible();
    await expect(tourDialog.getByRole("button", { name: "Go to tour step 1" })).toHaveAttribute("aria-current", "step");

    // Click Next
    const nextBtn = tourDialog.getByRole("button", { name: "Next" });
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    await expect(tourDialog.getByRole("button", { name: "Go to tour step 2" })).toHaveAttribute("aria-current", "step");

    // Click Previous
    const prevBtn = tourDialog.getByRole("button", { name: "Back" });
    await expect(prevBtn).toBeVisible();
    await prevBtn.click();

    await expect(tourDialog.getByRole("button", { name: "Go to tour step 1" })).toHaveAttribute("aria-current", "step");

    // Close tour via Escape
    await page.keyboard.press("Escape");
    await expect(tourDialog).not.toBeVisible();

    // 3. AI Copilot Bubble and Drawer
    const copilotBtn = page.getByRole("button", { name: "Open AI Copilot" });
    await expect(copilotBtn).toBeVisible();
    await copilotBtn.click();

    const copilotSheet = page.getByRole("dialog");
    await expect(copilotSheet).toBeVisible();
    await expect(copilotSheet.getByText("Zentro Copilot")).toBeVisible();

    // Check tabs
    await expect(
      copilotSheet.getByRole("tab", { name: "Context" }),
    ).toBeVisible();
    await expect(
      copilotSheet.getByRole("tab", { name: "Micro-Ops" }),
    ).toBeVisible();
    await expect(
      copilotSheet.getByRole("tab", { name: "Custodian" }),
    ).toBeVisible();

    // Switch to Custodian tab
    await copilotSheet.getByRole("tab", { name: "Custodian" }).click();
    const runSweepBtn = copilotSheet.getByRole("button", {
      name: "Run Workspace Maintenance",
    });
    await expect(runSweepBtn).toBeVisible();

    // Run sweep
    await runSweepBtn.click();
    await expect(copilotSheet.getByText("Sweep Summary")).toBeVisible({
      timeout: 10_000,
    });

    // Close AI copilot sheet
    await page.keyboard.press("Escape");
    await expect(copilotSheet).not.toBeVisible();
  });
});
