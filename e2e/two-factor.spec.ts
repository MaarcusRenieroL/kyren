import { expect, test } from "./fixtures";

import { password, registerWithOrganization, uniqueName } from "./helpers";
import { totp } from "./totp";

test("two-factor sign-in: set up, sign in with a code, then with a backup code, then turn off @auth", async ({
  page,
  context,
}) => {
  const { email } = await registerWithOrganization(page, {
    label: "twofa",
    orgName: uniqueName("2FA org"),
  });

  await page.goto("/settings/account/security");
  await page.getByRole("button", { name: "Set up" }).click();
  await page.getByLabel("Confirm your password to continue").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();

  const secret = (await page.getByLabel("Setup key").innerText()).trim();
  const backupCodes = await page
    .getByRole("list", { name: "Backup codes" })
    .getByRole("listitem")
    .allInnerTexts();

  expect(secret.length).toBeGreaterThan(10);
  expect(backupCodes.length).toBeGreaterThan(3);

  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText("On", { exact: true })).toBeVisible();

  async function signInUntilCode() {
    await context.clearCookies();
    await page.goto("/auth/sign-in");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Enter your code" }),
    ).toBeVisible();
  }

  // A wrong code is refused and keeps the person on the code step.
  await signInUntilCode();
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code didn’t work")).toBeVisible();

  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).not.toHaveURL(/\/auth\/sign-in/);

  // A backup code works too.
  await signInUntilCode();
  await page.getByRole("button", { name: "Use a backup code" }).click();
  await page.getByLabel("Backup code").fill(backupCodes[0]!.trim());
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).not.toHaveURL(/\/auth\/sign-in/);

  // Turning it off puts sign-in back to a password alone.
  await page.goto("/settings/account/security");
  await page.getByRole("button", { name: "Turn off" }).click();
  await page.getByLabel("Confirm your password to continue").fill(password);
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByText("Off", { exact: true })).toBeVisible();

  await context.clearCookies();
  await page.goto("/auth/sign-in");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/sign-in/);
});

test("a sign-in challenge allows only a few code guesses @auth", async ({
  page,
  context,
}) => {
  const { email } = await registerWithOrganization(page, {
    label: "twofa-limit",
    orgName: uniqueName("2FA limit org"),
  });

  await page.goto("/settings/account/security");
  await page.getByRole("button", { name: "Set up" }).click();
  await page.getByLabel("Confirm your password to continue").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();

  const secret = (await page.getByLabel("Setup key").innerText()).trim();

  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText("On", { exact: true })).toBeVisible();

  await context.clearCookies();
  await page.goto("/auth/sign-in");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Enter your code" }),
  ).toBeVisible();

  for (let guess = 0; guess < 5; guess += 1) {
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("That code didn’t work")).toBeVisible();
  }

  // The right code no longer helps: this challenge is used up.
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/Too many attempts/)).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});
