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

  it("limits where scripts, frames, forms and plugins may come from", () => {
    const csp = byKey["Content-Security-Policy"]!;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // Scripts may not load from other sites.
    expect(csp).not.toMatch(/script-src[^;]*https:/);
  });

  it("isolates the window from other sites", () => {
    expect(byKey["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(byKey["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });
});
