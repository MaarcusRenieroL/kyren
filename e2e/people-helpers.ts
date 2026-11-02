import type { Browser, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { expect } from "./fixtures";
import {
  addMemberDirectly,
  newContext,
  query,
  registerUser,
  registerWithOrganization,
  signIn,
  uniqueName,
} from "./helpers";

/** An owner (the given page) and a plain member in one fresh organization. */
export async function orgWithMember(
  browser: Browser,
  owner: Page,
  label: string,
) {
  const orgName = uniqueName(label);
  const { email: ownerEmail } = await registerWithOrganization(owner, {
    label: `${label}-owner`,
    orgName,
  });

  const session = await newContext(browser);
  const { email: memberEmail } = await registerUser(
    session.page,
    `${label}-member`,
  );

  await addMemberDirectly(orgName, memberEmail, "member");
  await session.context.clearCookies();
  await signIn(session.page, memberEmail);
  await expect(session.page).toHaveURL(/\/dashboard/);

  const nameOf = async (email: string) =>
    (
      await query<{ name: string }>(
        `select name from "user" where email = $1`,
        [email],
      )
    )[0]!.name;

  return {
    orgName,
    ownerEmail,
    memberEmail,
    ownerName: await nameOf(ownerEmail),
    memberName: await nameOf(memberEmail),
    member: session.page,
    close: () => session.context.close(),
  };
}

/** Fails on serious or critical accessibility violations. */
export async function expectNoSeriousA11yIssues(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page })
    // Toasts fade in, so their contrast is measured mid-animation.
    .exclude("[data-sonner-toaster]")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );

  expect(
    serious.map(
      (violation) =>
        `${violation.id}: ${violation.help} ${violation.nodes
          .slice(0, 3)
          .map((node) => node.html.slice(0, 120))
          .join(" | ")}`,
    ),
    `${where} has accessibility violations`,
  ).toEqual([]);
}

/** Accepts the next confirm() dialog. */
export function acceptNextConfirm(page: Page) {
  page.once("dialog", (dialog) => void dialog.accept());
}
