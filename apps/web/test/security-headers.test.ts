import { describe, expect, it } from "vitest";

import { securityHeaders } from "../security-headers";

describe("security headers", () => {
  const byKey = Object.fromEntries(
    securityHeaders.map((header) => [header.key, header.value]),
  );

  it("blocks framing, sniffing and plain-HTTP downgrades", () => {
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Strict-Transport-Security"]).toMatch(/max-age=\d{7,}/);
  });

  it("limits referrers and powerful browser features", () => {
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Permissions-Policy"]).toContain("camera=()");
  });
});
