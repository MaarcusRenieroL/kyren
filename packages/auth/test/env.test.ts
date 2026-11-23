import { describe, expect, it } from "vitest";

import { productionWarnings } from "../src/lib/env";
import { trustedOriginsFor } from "../src/lib/origins";

describe("trustedOriginsFor", () => {
  it("trusts localhost only outside production", () => {
    expect(trustedOriginsFor("https://app.example.com", "production")).toEqual([
      "https://app.example.com",
    ]);
    expect(trustedOriginsFor("https://app.example.com", "development")).toEqual(
      ["https://app.example.com", "http://localhost:3000"],
    );
  });

  it("lists the base origin once", () => {
    expect(trustedOriginsFor("http://localhost:3000", "development")).toEqual([
      "http://localhost:3000",
    ]);
  });
});

describe("productionWarnings", () => {
  it("flags settings that make production quietly fail", () => {
    const warnings = productionWarnings({});

    expect(warnings.join(" ")).toMatch(/EMAIL_FROM/);
    expect(warnings.join(" ")).toMatch(/CRON_SECRET/);
    expect(warnings.join(" ")).toMatch(/file storage/i);
  });

  it("is quiet when everything is set", () => {
    expect(
      productionWarnings({
        EMAIL_FROM: "Kyren <hello@example.com>",
        CRON_SECRET: "x".repeat(32),
        FILE_STORAGE: "s3",
      }),
    ).toEqual([]);
  });
});

import { twoFactorChallenge } from "../src/lib/two-factor-challenge";

describe("twoFactorChallenge", () => {
  it("fingerprints the pending challenge cookie, plain or secure-prefixed", () => {
    const plain = twoFactorChallenge(
      "a=1; better-auth.two_factor=abc.def; b=2",
    );
    const secure = twoFactorChallenge(
      "__Secure-better-auth.two_factor=abc.def",
    );

    expect(plain).toMatch(/^[0-9a-f]{32}$/);
    expect(secure).toBe(plain);
    expect(twoFactorChallenge("better-auth.two_factor=other")).not.toBe(plain);
  });

  it("is null without a challenge", () => {
    expect(twoFactorChallenge("session=1")).toBeNull();
    expect(twoFactorChallenge(null)).toBeNull();
  });
});
