import { writeFileSync } from "node:fs";

import type { Browser, Page } from "@playwright/test";

import { test } from "./fixtures";
import { query } from "./helpers";

const OUT =
  "/private/tmp/claude-501/-Users-maarcusrenierol-Desktop-projects-zentro/53cc9eaa-b8de-42c8-aa5e-347d667dd338/scratchpad/audit";
const PASSWORD = "Zentro-demo-1234";
const ORG = "5cba4782-7a7d-4b3b-8ffe-0222125241fc";

const one = async (sql: string, params: unknown[] = []) =>
  (await query<Record<string, string>>(sql, params))[0] ?? {};

async function routes() {
  const p = await one(
    `select slug from project where "organizationId"=$1 and "deletedAt" is null order by "updatedAt" desc limit 1`,
    [ORG],
  );
  const t = await one(
    `select key from task where "organizationId"=$1 and "deletedAt" is null order by "updatedAt" desc limit 1`,
    [ORG],
  );
  const d = await one(
    `select slug from doc where "organizationId"=$1 and "deletedAt" is null order by "updatedAt" desc limit 1`,
    [ORG],
  );
  const c = await one(
    `select name from "chatChannel" where "organizationId"=$1 and kind='channel' and visibility='public' and "archivedAt" is null limit 1`,
    [ORG],
  );
  const m = await one(
    `select id from meeting where "organizationId"=$1 limit 1`,
    [ORG],
  );
  const pr = await one(
    `select id from "payRun" where "organizationId"=$1 order by "createdAt" desc limit 1`,
    [ORG],
  );
  const tk = await one(
    `select id from ticket where "organizationId"=$1 order by "createdAt" desc limit 1`,
    [ORG],
  );
  const wb = await one(
    `select id from whiteboard where "organizationId"=$1 and "deletedAt" is null limit 1`,
    [ORG],
  );
  const role = await one(
    `select id from role where "organizationId"=$1 and "systemKey"='member' limit 1`,
    [ORG],
  );
  const team = await one(
    `select id from team where "organizationId"=$1 limit 1`,
    [ORG],
  );
  const org = await one(`select slug from organization where id=$1`, [ORG]);
  const kb = await one(
    `select slug from "kbArticle" where "organizationId"=$1 and status='published' and audience='public' limit 1`,
    [ORG],
  );
  const mod = "tasks";

  const app = [
    "/dashboard", "/overview", "/inbox", "/modules", `/modules/${mod}`,
    "/projects", `/projects/${p.slug}`, `/projects/${p.slug}/settings/general`,
    `/projects/${p.slug}/settings/access`, `/projects/${p.slug}/settings/danger`,
    "/tasks", `/tasks/${t.key}`, "/tasks/goals", "/tasks/import", "/tasks/overview",
    "/tasks/timesheet", "/tasks/trash",
    "/docs", `/docs/${d.slug}`, "/docs/my-docs", "/docs/projects", "/docs/recent",
    "/docs/search", "/docs/trash",
    "/chat", `/chat/${c.name}`, "/chat/catch-up", "/chat/drafts", "/chat/mentions",
    "/chat/saved", "/chat/search", "/chat/threads",
    "/files", "/calendar", "/calendar/meetings", `/calendar/meetings/${m.id}`,
    "/whiteboards", `/whiteboards/${wb.id}`, "/mail",
    "/tickets", `/tickets/${tk.id}`,
    "/hr", "/hr/import", "/hr/leave",
    "/payroll", `/payroll/${pr.id}`,
    "/admin", "/admin/api-keys", "/admin/network", "/admin/retention", "/admin/security",
    "/admin/task-fields", "/admin/usage", "/admin/webhooks",
    "/settings/account/profile", "/settings/account/security",
    "/settings/account/notifications", "/settings/account/appearance",
    "/settings/organization/general", "/settings/organization/members",
    "/settings/organization/teams", `/settings/organization/teams/${team.id}`,
    "/settings/organization/invitations", "/settings/organization/modules",
    "/settings/organization/roles", `/settings/organization/roles/${role.id}`,
    "/settings/organization/roles/assignments", "/settings/organization/roles/log",
    "/settings/organization/roles/access-check", "/settings/organization/audit-log",
    "/settings/organization/automations", "/settings/organization/danger",
    "/platform", "/module-disabled",
  ].filter((r) => !r.includes("undefined"));
  const open = [
    "/", "/about", "/pricing", "/privacy", "/terms", "/cookies", "/security",
    "/status", "/changelog", "/roadmap", "/auth/sign-in", "/auth/sign-up",
    "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email",
    `/help/${org.slug}`, kb.slug ? `/help/${org.slug}/${kb.slug}` : "",
    "/maintenance",
  ].filter(Boolean);

  return { app, open };
}

async function signedIn(
  browser: Browser,
  baseURL: string,
  email: string,
  size: { width: number; height: number },
  colorScheme: "light" | "dark",
) {
  const context = await browser.newContext({ baseURL, viewport: size, colorScheme });
  const page = await context.newPage();
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password: PASSWORD },
    headers: { origin: baseURL },
  });

  if (!res.ok()) throw new Error(`sign-in failed for ${email}: ${res.status()}`);

  const active = await page.request.post("/api/auth/organization/set-active", {
    data: { organizationId: ORG },
    headers: { origin: baseURL },
  });

  if (!active.ok()) throw new Error(`set-active failed for ${email}: ${active.status()}`);

  return { context, page };
}


const SKIP =
  /delete|remove|trash|purge|archive|send|sign ?out|log ?out|revoke|reject|approve|transfer|leave|disable|turn (on|off)|cancel meeting|reset|pay\b|paid|close poll|restore|discard|erase|place hold|block|mark (all )?(read|done)|start|pause|finish|resolve|merge|unassign|deactivate|suspend|replace|switch on/i;

type Issue = { kind: string; route: string; detail: string };

/** Focus outline, contrast and timing for the page as it is. */
const INSPECT = () => {
  const out: { contrast: string[]; perf: Record<string, number> } = { contrast: [], perf: {} };
  const parse = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = "1"] = m[1]!.split(/[ ,/]+/).filter(Boolean);
    return [Number(r), Number(g), Number(b), Number(a)];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
  };
  const bgOf = (el: Element | null): number[] => {
    while (el) {
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c && c[3]! > 0.5) return c;
      el = el.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
  };
  const seen = new Set<string>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n = 0;
  while (walker.nextNode() && n < 600) {
    const node = walker.currentNode;
    const el = node.parentElement;
    const text = (node.textContent ?? "").trim();
    if (!el || !text) continue;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.width < 3 || r.height < 3 || st.visibility === "hidden" || Number(st.opacity) < 0.6) continue;
    if (el.closest("[aria-hidden=true], .sr-only, button:disabled, [disabled], [data-disabled]")) continue;
    n++;
    const fg = parse(st.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(st.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(st.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const key = `${st.color}|${bg.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.contrast.push(`${ratio.toFixed(2)}:1 "${text.slice(0, 30)}" ${st.color} on rgb(${bg.slice(0, 3).join(",")}) ${size}px`);
    }
  }
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav) {
    out.perf.ttfb = Math.round(nav.responseStart);
    out.perf.dcl = Math.round(nav.domContentLoadedEventEnd);
    out.perf.load = Math.round(nav.loadEventEnd);
  }
  const api = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
    .filter((e) => e.name.includes("/api/trpc"));
  out.perf.apiCalls = api.length;
  out.perf.apiSlowest = Math.round(Math.max(0, ...api.map((e) => e.duration)));
  out.perf.jsKb = Math.round(
    (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((e) => e.name.endsWith(".js"))
      .reduce((s, e) => s + (e.transferSize || 0), 0) / 1024,
  );
  return out;
};

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => undefined);
}

async function deep(page: Page, route: string, issues: Issue[], tag: string) {
  const errors: string[] = [];
  const onErr = (e: Error) => errors.push(`pageerror ${e.message.slice(0, 120)}`);
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === "error" && !/Failed to load resource: .*(403|404)/.test(m.text())) errors.push(m.text().slice(0, 140));
  };
  const onResp = (r: { status(): number; url(): string }) => {
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 90)}`);
  };
  page.on("pageerror", onErr);
  page.on("console", onConsole);
  page.on("response", onResp);
  const flush = (ctx: string) => {
    for (const e of errors.splice(0)) issues.push({ kind: "error", route, detail: `${tag} ${ctx}: ${e}` });
  };

  await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await settle(page);

  const inspected = await Promise.race([
    page.evaluate(INSPECT),
    new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
  ]).catch(() => null);
  if (inspected) {
    for (const c of inspected.contrast.slice(0, 5)) issues.push({ kind: "contrast", route, detail: `${tag} ${c}` });
    issues.push({ kind: "perf", route, detail: `${tag} ${JSON.stringify(inspected.perf)}` });
  }
  flush("load");

  // Keyboard: what Tab reaches must show where focus is.
  if (tag.endsWith("desktop")) {
    const invisible = new Set<string>();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const st = getComputedStyle(el);
        const ring =
          (st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0) ||
          (st.boxShadow && st.boxShadow !== "none");
        return ring ? null : `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}"`;
      }).catch(() => null);
      if (r) invisible.add(r);
    }
    for (const r of [...invisible].slice(0, 4)) issues.push({ kind: "focus", route, detail: `${tag} no visible focus: ${r}` });
  }

  // Click every safe button in the main area once.
  const buttons = await page.evaluate((skip) => {
    const re = new RegExp(skip, "i");
    const main = document.querySelector("main") ?? document.body;
    return [...main.querySelectorAll("button, [role=tab], [role=button]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
        return r.width > 0 && r.height > 0 && !(el as HTMLButtonElement).disabled && name && !re.test(name) && el.getAttribute("type") !== "submit";
      })
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60));
  }, SKIP.source).catch(() => [] as string[]);

  for (const name of [...new Set(buttons)].slice(0, 20)) {
    const before = page.url();
    try {
      const target = page.getByRole("main").getByRole("button", { name, exact: true }).first();
      if (!(await target.isVisible().catch(() => false))) continue;
      const domBefore = await page.evaluate(() => document.body.innerHTML.length);
      await target.click({ timeout: 3_000 });
      await page.waitForTimeout(350);
      const domAfter = await page.evaluate(() => document.body.innerHTML.length).catch(() => domBefore);
      const opened = await page.locator("[role=dialog], [role=menu], [role=listbox]").count().catch(() => 0);
      if (page.url() === before && domAfter === domBefore && opened === 0) {
        issues.push({ kind: "dead-button", route, detail: `${tag} "${name}" changed nothing` });
      }
      // A dialog with a form: submitting it empty must say what is wrong.
      const dialog = page.getByRole("dialog").first();
      if (await dialog.isVisible().catch(() => false)) {
        const submit = dialog.locator("button[type=submit]").first();
        if (await submit.isVisible().catch(() => false)) {
          if (await submit.isEnabled().catch(() => false)) {
            await submit.click({ timeout: 2_000 }).catch(() => undefined);
            await page.waitForTimeout(400);
            const said = await dialog.locator("[role=alert], [aria-invalid=true], .text-danger-text, [data-invalid]").count().catch(() => 0);
            const stillOpen = await dialog.isVisible().catch(() => false);
            if (stillOpen && said === 0) {
              issues.push({ kind: "form", route, detail: `${tag} dialog from "${name}": empty submit gives no message` });
            }
          }
        }
        // Focus stays inside an open dialog.
        for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
        const inside = await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")).catch(() => true);
        if (!inside && (await dialog.isVisible().catch(() => false))) {
          issues.push({ kind: "focus-trap", route, detail: `${tag} dialog from "${name}": Tab leaves the dialog` });
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(700);
        if (await dialog.isVisible().catch(() => false)) {
          issues.push({ kind: "escape", route, detail: `${tag} dialog from "${name}" does not close on Escape` });
          await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => undefined);
          await settle(page);
        }
      } else {
        await page.keyboard.press("Escape").catch(() => undefined);
      }
      if (page.url() !== before) {
        await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await settle(page);
      }
      flush(`after "${name}"`);
    } catch {
      // A control that can't be clicked here is covered by the layout audit.
    }
  }

  page.off("pageerror", onErr);
  page.off("console", onConsole);
  page.off("response", onResp);
  console.log(`[deep] ${tag} ${route}`);
}

test("deep audit", async ({ browser, baseURL }) => {
  test.setTimeout(10_800_000);

  const issues: Issue[] = [];
  const { app, open } = await routes();
  const save = () => writeFileSync(`${OUT}/deep.json`, JSON.stringify(issues, null, 1));
  const runs: Array<[string, { width: number; height: number }, "light" | "dark", string]> = [
    ["priya@acme.test", { width: 1440, height: 900 }, "light", "owner/desktop"],
    ["priya@acme.test", { width: 1440, height: 900 }, "dark", "owner/dark"],
    ["meilin@acme.test", { width: 390, height: 844 }, "light", "member/phone"],
  ];

  for (const [email, size, scheme, tag] of runs) {
    const { context, page } = await signedIn(browser, baseURL!, email, size, scheme);

    for (const route of app) {
      await deep(page, route, issues, tag);
      save();
    }
    await context.close();
  }

  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const route of open) {
    await deep(page, route, issues, "visitor/desktop");
    save();
  }
  await context.close();
});
