import { expect, test } from "./fixtures";

import { registerWithOrganization, uniqueName } from "./helpers";

const pages = [
  "/dashboard",
  "/tasks",
  "/projects",
  "/docs",
  "/chat",
  "/files",
  "/calendar",
  "/whiteboards",
  "/mail",
  "/tickets",
  "/hr",
  "/payroll",
  "/inbox",
  "/settings/account/security",
];

test("pages send a CSP and run without a single violation @security", async ({
  page,
}) => {
  const violations: string[] = [];

  page.on("console", (message) => {
    const text = message.text();

    if (/content security policy|violates the following/i.test(text)) {
      violations.push(`${page.url()}: ${text.slice(0, 200)}`);
    }
  });

  // Public pages run under the same policy, before anyone signs in.
  for (const path of ["/", "/auth/sign-in", "/auth/sign-up"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }

  await registerWithOrganization(page, {
    label: "csp",
    orgName: uniqueName("CSP org"),
  });

  const response = await page.goto("/dashboard");
  const csp = response?.headers()["content-security-policy"] ?? "";

  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  // Inline scripts run only with this response's nonce.
  expect(csp).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9+/=]+'/);
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);

  const again = await page.goto("/dashboard");

  expect(again?.headers()["content-security-policy"]).not.toBe(csp);

  for (const path of pages) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }

  expect(violations).toEqual([]);
});
