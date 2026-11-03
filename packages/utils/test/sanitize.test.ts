import { describe, expect, it } from "vitest";

import { sanitizeRichText } from "../src/sanitize";

describe("sanitizeRichText", () => {
  it("keeps ordinary formatting", () => {
    const html =
      "<h2>Plan</h2><p>Some <strong>bold</strong>, <em>italic</em> and <code>code</code>.</p><ul><li>one</li></ul><blockquote>quote</blockquote>";

    expect(sanitizeRichText(html)).toBe(html);
  });

  it.each([
    ["<img src=x onerror=alert(1)>", "onerror"],
    ["<script>alert(1)</script>", "script"],
    ['<a href="javascript:alert(1)">x</a>', "javascript"],
    ['<a href="JaVaScRiPt:alert(1)">x</a>', "javascript"],
    ['<a href="data:text/html,<script>alert(1)</script>">x</a>', "data:"],
    ['<iframe src="https://evil.test"></iframe>', "iframe"],
    ["<svg onload=alert(1)><circle/></svg>", "onload"],
    ['<p style="background:url(javascript:alert(1))">x</p>', "style"],
    ['<div onclick="alert(1)">x</div>', "onclick"],
    ["<object data=x></object><embed src=x>", "embed"],
    ['<form action="https://evil.test"><button>go</button></form>', "form"],
    ["<math><mtext><img src=x onerror=alert(1)>", "onerror"],
  ])("removes %s", (payload, forbidden) => {
    expect(sanitizeRichText(payload).toLowerCase()).not.toContain(forbidden);
  });

  it("keeps safe links and hardens them", () => {
    const out = sanitizeRichText(
      '<a href="https://example.com" target="_blank">site</a><a href="mailto:a@b.co">mail</a>',
    );

    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('href="mailto:a@b.co"');
  });

  it("keeps read-only task list check boxes", () => {
    const out = sanitizeRichText(
      '<ul data-type="taskList"><li data-checked="true"><input type="checkbox" checked onclick="x()"></li></ul>',
    );

    expect(out).toContain('type="checkbox"');
    expect(out).toContain("disabled");
    expect(out).not.toContain("onclick");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeRichText("")).toBe("");
  });
});
