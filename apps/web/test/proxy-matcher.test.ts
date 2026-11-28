import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@kyren/auth", () => ({ auth: {} }));
vi.mock("~/src/lib/paths", () => ({ paths: {} }));

const { config, protectedPrefixes, publicPrefixes } =
  await import("../src/proxy");

// Next compiles the matcher as a path pattern; for this negative-lookahead
// pattern, anchoring the source is the same test Next performs.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("the sign-in proxy", () => {
  it("covers every workspace page folder, so no module is reachable signed out", () => {
    const root = path.join(__dirname, "../src/app/(workspace)");
    const folders = readdirSync(root).filter((name) =>
      statSync(path.join(root, name)).isDirectory(),
    );
    const covered = protectedPrefixes.map((entry) => entry.split("/")[1]);

    expect(folders.length).toBeGreaterThan(10);
    expect(folders.filter((name) => !covered.includes(name))).toEqual([]);
  });

  it("treats every marketing page folder as public, so it stays static", () => {
    const root = path.join(__dirname, "../src/app/(site)");
    const folders = readdirSync(root).filter((name) =>
      statSync(path.join(root, name)).isDirectory(),
    );
    const publicFolders = publicPrefixes.map((entry) => entry.slice(1));

    expect(folders.length).toBeGreaterThan(10);
    expect(folders.filter((name) => !publicFolders.includes(name))).toEqual([]);
  });

  it("runs on every protected prefix, so the gate is never skipped", () => {
    for (const prefix of protectedPrefixes) {
      expect(matcher.test(prefix), prefix).toBe(true);
      expect(matcher.test(`${prefix}/example`), `${prefix}/example`).toBe(true);
    }
  });

  it.each([
    "/",
    "/pricing",
    "/pricing/compare",
    "/dashboard",
    "/tasks/ZEN-99",
    "/docs/v1.2",
    "/auth/invite/code.with.dots",
  ])("runs on the page %s, so it gets the auth gate and a CSP", (pathname) => {
    expect(matcher.test(pathname)).toBe(true);
  });

  it.each([
    "/api/trpc",
    "/api/auth/session",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/_vercel/insights/script.js",
    "/favicon.ico",
    "/images/logo.png",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/styles/globals.css",
    "/fonts/inter.woff2",
  ])("skips the static asset %s", (pathname) => {
    expect(matcher.test(pathname)).toBe(false);
  });
});
