import { randomInt } from "node:crypto";

import {
  expect,
  test as base,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

export { expect } from "@playwright/test";

export function randomClientIp() {
  return `10.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 255)}`;
}

export type SeedUser = {
  id: string;
  email: string;
  name: string;
  password: string;
};

export type Seed = {
  orgId: string;
  slug: string;
  owner: SeedUser;
  member: SeedUser;
};

/** Creates a verified owner, a verified member and an organization. */
export async function seedOrganization(
  request: APIRequestContext,
): Promise<Seed> {
  const response = await request.post("/api/test/seed", {
    headers: { "x-seed-secret": process.env.E2E_SEED_SECRET ?? "" },
  });

  expect(response.status(), "the seed route must be enabled").toBe(200);

  return (await response.json()) as Seed;
}

/**
 * Signs `user` in through Better Auth's email endpoint. The cookies land in the
 * browser context of `page`, so later navigation is signed in.
 */
export async function signInViaApi(
  page: Page,
  origin: string,
  user: Pick<SeedUser, "email" | "password">,
) {
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.password },
    headers: { origin },
  });

  expect(response.ok(), `sign-in as ${user.email} failed`).toBe(true);
}

function watchErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
}

type Fixtures = {
  /** A fresh organization with a verified owner and member. */
  seed: Seed;
  /** A page signed in as the seeded owner, in its own browser context. */
  asOwner: Page;
  /** A page signed in as the seeded member, in its own browser context. */
  asMember: Page;
  /** Fails the test on any console or uncaught error from its pages. */
  guard: void;
  pageErrors: string[];
};

// Better Auth rate-limits by client IP (for example 3 verification emails per
// minute), and every test shares 127.0.0.1. Give each test its own forwarded
// address so tests do not throttle each other.
export const test = base.extend<Fixtures>({
  extraHTTPHeaders: async ({}, use) => {
    await use({ "x-forwarded-for": randomClientIp() });
  },

  pageErrors: async ({}, use) => {
    await use([]);
  },

  guard: [
    async ({ page, pageErrors }, use) => {
      watchErrors(page, pageErrors);
      await use();
      expect(pageErrors, "console or page errors").toEqual([]);
    },
    { auto: false },
  ],

  seed: async ({ request }, use) => {
    await use(await seedOrganization(request));
  },

  asOwner: async ({ browser, baseURL, seed, pageErrors }, use) => {
    const context = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": randomClientIp() },
    });
    const page = await context.newPage();

    watchErrors(page, pageErrors);
    await signInViaApi(page, baseURL ?? "", seed.owner);
    await use(page);
    await context.close();
  },

  asMember: async ({ browser, baseURL, seed, pageErrors }, use) => {
    const context = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": randomClientIp() },
    });
    const page = await context.newPage();

    watchErrors(page, pageErrors);
    await signInViaApi(page, baseURL ?? "", seed.member);
    await use(page);
    await context.close();
  },
});
