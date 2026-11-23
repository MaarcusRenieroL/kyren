import { describe, expect, it } from "vitest";

import { authBaseUrl } from "../src/lib/base-url";

describe("authBaseUrl", () => {
  it("joins origin, prefix and the auth path", () => {
    expect(authBaseUrl("http://localhost:3000", "")).toBe(
      "http://localhost:3000/api/auth",
    );
    expect(authBaseUrl("https://x.dev", "/kyren")).toBe(
      "https://x.dev/kyren/api/auth",
    );
  });

  it("ignores trailing slashes on the origin and the prefix", () => {
    expect(authBaseUrl("https://x.dev/", "/kyren/")).toBe(
      "https://x.dev/kyren/api/auth",
    );
    expect(authBaseUrl("https://x.dev///", "")).toBe("https://x.dev/api/auth");
  });

  it("accepts a prefix written without a leading slash", () => {
    expect(authBaseUrl("https://x.dev", "kyren")).toBe(
      "https://x.dev/kyren/api/auth",
    );
  });
});
