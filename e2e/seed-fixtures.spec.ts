import { expect, test } from "./fixtures";

test.describe("seed route and fixtures @fixtures", () => {
  test("the seed route answers 404 without the secret @fixtures", async ({
    request,
  }) => {
    const missing = await request.post("/api/test/seed");
    const wrong = await request.post("/api/test/seed", {
      headers: { "x-seed-secret": "not-the-secret" },
    });

    expect(missing.status()).toBe(404);
    expect(wrong.status()).toBe(404);
  });

  test("the seed creates an owner, a member and an organization @fixtures", async ({
    seed,
  }) => {
    expect(seed.orgId).toBeTruthy();
    expect(seed.slug).toMatch(/^e2e-/);
    expect(seed.owner.email).not.toBe(seed.member.email);
  });

  test("the seeded owner and member sign in and reach the dashboard @fixtures", async ({
    asOwner,
    asMember,
  }) => {
    await asOwner.goto("/dashboard");
    await expect(asOwner).toHaveURL(/\/dashboard/);

    await asMember.goto("/dashboard");
    await expect(asMember).toHaveURL(/\/dashboard/);
  });

  test("a wrong password does not sign in @fixtures", async ({
    page,
    seed,
    baseURL,
  }) => {
    const response = await page.request.post("/api/auth/sign-in/email", {
      data: { email: seed.owner.email, password: "wrong-password-123" },
      headers: { origin: baseURL ?? "" },
    });

    expect(response.ok()).toBe(false);
  });
});
