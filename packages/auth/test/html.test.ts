import { describe, expect, it } from "vitest";

import { escapeHtml } from "../src/lib/html";

describe("escapeHtml", () => {
  it("neutralises markup and attribute breaks", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });

  it("leaves plain text alone", () => {
    expect(escapeHtml("Acme Studio 2")).toBe("Acme Studio 2");
  });
});
