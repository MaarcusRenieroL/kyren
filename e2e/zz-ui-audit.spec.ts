import { writeFileSync } from "node:fs";

import type { Browser, Page } from "@playwright/test";

import { test } from "./fixtures";
import { query } from "./helpers";

const OUT =
  "/private/tmp/claude-501/-Users-maarcusrenierol-Desktop-projects-zentro/53cc9eaa-b8de-42c8-aa5e-347d667dd338/scratchpad/audit";
const PASSWORD = "Zentro-demo-1234";
const ORG = "5cba4782-7a7d-4b3b-8ffe-0222125241fc";

type Finding = {
  who: string;
  viewport: string;
  route: string;
  status: number | null;
  finalUrl: string;
  errors: string[];
  failedRequests: string[];
  checks: Record<string, unknown>;
};

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

const CHECKS = () => {
  const vw = window.innerWidth;
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const describe = (el: Element) =>
    `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${
      typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""
    } "${(el.textContent ?? "").trim().slice(0, 40)}"`;
  const all = [...document.querySelectorAll("body *")];
  const overflowing = all
    .filter((el) => {
      if (!visible(el)) return false;
      const r = el.getBoundingClientRect();
      // Ignore things inside a scroll container (they are meant to overflow).
      let p = el.parentElement;
      while (p) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden)/.test(s.overflowX)) return false;
        p = p.parentElement;
      }
      return r.right > vw + 1 || r.left < -1;
    })
    .slice(0, 8)
    .map(describe);
  const unnamed = [...document.querySelectorAll("button, a[href], [role=button]")]
    .filter((el) => visible(el))
    .filter((el) => {
      const name =
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.getAttribute("title") ||
        (el.textContent ?? "").trim() ||
        el.querySelector("img[alt]")?.getAttribute("alt");
      return !name;
    })
    .slice(0, 8)
    .map(describe);
  const unlabeled = [...document.querySelectorAll("input:not([type=hidden]), textarea, select")]
    .filter((el) => visible(el))
    .filter((el) => {
      const id = el.id;
      return !(
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
        el.closest("label")
      );
    })
    .slice(0, 8)
    .map((el) => `${describe(el)} placeholder=${el.getAttribute("placeholder")}`);
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  const dupIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].slice(0, 8);
  const broken = [...document.querySelectorAll("img")]
    .filter((img) => img.complete && img.naturalWidth === 0 && visible(img))
    .map((img) => img.getAttribute("src"))
    .slice(0, 5);
  const clipped = all
    .filter((el) => {
      if (!visible(el) || el.children.length) return false;
      const s = getComputedStyle(el);
      return (
        el.scrollWidth > el.clientWidth + 2 &&
        s.overflowX === "hidden" &&
        s.textOverflow !== "ellipsis" &&
        (el.textContent ?? "").trim().length > 0
      );
    })
    .slice(0, 6)
    .map(describe);
  const box = (el: Element) => el.getBoundingClientRect();
  const isSrOnly = (el: Element) => {
    const r = box(el);
    return r.width <= 2 || r.height <= 2 || (el as HTMLElement).classList?.contains("sr-only");
  };
  const clippedReal = all
    .filter((el) => {
      if (!visible(el) || isSrOnly(el) || el.children.length) return false;
      const st = getComputedStyle(el);
      return (
        (el.textContent ?? "").trim().length > 0 &&
        el.scrollWidth > el.clientWidth + 2 &&
        /(hidden|clip)/.test(st.overflowX) &&
        st.textOverflow !== "ellipsis"
      );
    })
    .slice(0, 8)
    .map(describe);
  // Controls and headings drawn on top of each other.
  const solid = [...document.querySelectorAll(
    "button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], h1, h2, h3",
  )]
    .filter((el) => visible(el) && !isSrOnly(el))
    .filter((el) => {
      const r = box(el);
      return r.bottom > 0 && r.top < window.innerHeight * 2;
    })
    .slice(0, 400);
  const overlaps: string[] = [];
  for (let i = 0; i < solid.length && overlaps.length < 10; i++) {
    for (let j = i + 1; j < solid.length && overlaps.length < 10; j++) {
      const a = solid[i]!, b = solid[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      const ra = box(a), rb = box(b);
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 4 && h > 4) {
        // Only what a person sees: the top element at the overlap's centre.
        const cx = Math.max(ra.left, rb.left) + w / 2;
        const cy = Math.max(ra.top, rb.top) + h / 2;
        if (cy < 0 || cy > window.innerHeight) continue;
        overlaps.push(`${describe(a)}  ×  ${describe(b)}`);
      }
    }
  }
  // Text squeezed into a thin column: many lines, few words per line.
  const squeezed = all
    .filter((el) => {
      if (!visible(el) || isSrOnly(el)) return false;
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? "").join(" ").trim();
      if (text.split(/\s+/).length < 6) return false;
      const r = box(el);
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
      return r.width < 150 && r.height / lh >= 5;
    })
    .slice(0, 6)
    .map((el) => `${describe(el)} width=${Math.round(box(el).width)}`);
  const cutTabs = [...document.querySelectorAll("[role=tablist], nav")]
    .filter((el) => visible(el) && el.scrollWidth > el.clientWidth + 2)
    .filter((el) => !/(auto|scroll)/.test(getComputedStyle(el).overflowX))
    .slice(0, 4)
    .map(describe);
  const rawText = [...new Set(
    (document.body.innerText.match(/(undefined|NaN|\[object Object\]|enc:v1:|Invalid Date|null null)/g) ?? []),
  )];
  return {
    hScroll: document.documentElement.scrollWidth > vw + 1,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing,
    unnamed,
    unlabeled,
    dupIds,
    broken,
    clipped: clippedReal,
    overlaps,
    squeezed,
    cutTabs,
    rawText,
    h1: document.querySelectorAll("h1").length,
    title: document.title,
  };
};

async function audit(
  page: Page,
  who: string,
  viewport: string,
  route: string,
  findings: Finding[],
) {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  };
  const onError = (e: Error) => errors.push(`pageerror: ${e.message.slice(0, 200)}`);
  const onResponse = (r: { status(): number; url(): string }) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 120)}`);
  };

  page.on("console", onConsole);
  page.on("pageerror", onError);
  page.on("response", onResponse);

  let status: number | null = null;

  try {
    const res = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 30_000 });
    status = res?.status() ?? null;
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  } catch (error) {
    errors.push(`goto: ${(error as Error).message.slice(0, 160)}`);
  }

  const checks = await Promise.race([
    page.evaluate(CHECKS),
    new Promise((resolve) => setTimeout(() => resolve({ evalError: "timed out" }), 20_000)),
  ]).catch((e) => ({ evalError: String(e) })) as Record<string, unknown>;

  page.off("console", onConsole);
  page.off("pageerror", onError);
  page.off("response", onResponse);
  console.log(`[audit] ${who} ${viewport} ${route}`);
  findings.push({ who, viewport, route, status, finalUrl: page.url().replace(/^https?:\/\/[^/]+/, ""), errors, failedRequests, checks });
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

const views = [
  { name: "phone", size: { width: 390, height: 844 }, scheme: "light" as const },
  { name: "tablet", size: { width: 1024, height: 768 }, scheme: "light" as const },
  { name: "desktop", size: { width: 1440, height: 900 }, scheme: "light" as const },
  { name: "dark", size: { width: 1440, height: 900 }, scheme: "dark" as const },
];

/** Opens something on a page, then records it like a page of its own. */
async function state(
  page: Page,
  who: string,
  view: string,
  route: string,
  label: string,
  open: (page: Page) => Promise<unknown>,
  findings: Finding[],
) {
  await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

  try {
    await Promise.race([
      open(page),
      new Promise((_, reject) => setTimeout(() => reject(new Error("opener timed out")), 6_000)),
    ]);
    await page.waitForTimeout(400);
  } catch (error) {
    findings.push({
      who, viewport: view, route: `${route} [${label}]`, status: null, finalUrl: page.url(),
      errors: [`could not open: ${(error as Error).message.slice(0, 120)}`], failedRequests: [], checks: {},
    });
    return;
  }

  const checks = await Promise.race([
    page.evaluate(CHECKS),
    new Promise((resolve) => setTimeout(() => resolve({ evalError: "timed out" }), 20_000)),
  ]).catch((e) => ({ evalError: String(e) })) as Record<string, unknown>;
  console.log(`[audit] ${who} ${view} ${route} [${label}]`);
  findings.push({ who, viewport: view, route: `${route} [${label}]`, status: 200, finalUrl: page.url(), errors: [], failedRequests: [], checks });
  await page.keyboard.press("Escape").catch(() => undefined);
}

const click = (name: string | RegExp) => (page: Page) =>
  page.getByRole("button", { name }).first().click({ timeout: 5_000 });

test("ui audit", async ({ browser, baseURL }) => {
  test.setTimeout(10_800_000);

  const findings: Finding[] = [];
  const { app, open } = await routes();
  const save = () => writeFileSync(`${OUT}/report.json`, JSON.stringify(findings, null, 1));

  for (const view of views) {
    const people = view.name === "dark" ? ["priya@acme.test"] : ["priya@acme.test", "meilin@acme.test"];

    for (const email of people) {
      const who = email.split("@")[0]!;
      const { context, page } = await signedIn(browser, baseURL!, email, view.size, view.scheme);

      for (const route of app) {
        await audit(page, who, view.name, route, findings);
        save();
      }

      if (who === "priya") {
        const states: Array<[string, string, (page: Page) => Promise<unknown>]> = [
          ["/dashboard", "org-switcher", (p) => p.getByRole("button", { name: /^Organization:/ }).first().click()],
          ["/dashboard", "account-menu", click("Account menu")],
          ["/dashboard", "create-menu", click(/^Create/)],
          ["/dashboard", "command-palette", click("Open command palette")],
          ["/projects", "new-project", click("New project")],
          ["/tasks", "create-task", click("Create task")],
          ["/mail", "compose", click("Compose")],
          ["/calendar", "new-event", click("New event")],
          ["/calendar/meetings", "schedule-meeting", click("Schedule a meeting")],
          ["/hr", "add-person", click("Add person")],
          ["/hr/leave", "request-time-off", click("Request time off")],
          ["/settings/organization/members", "invite", click("Invite people")],
          ["/settings/organization/teams", "new-team", click("New team")],
          ["/tickets", "new-ticket", click("New ticket")],
          ["/docs", "new-doc", click("New doc")],
        ];

        if (view.name === "phone") {
          states.push(["/dashboard", "nav-drawer", click("Open navigation")]);
        } else {
          states.push(["/dashboard", "sidebar-collapsed", click("Toggle Sidebar")]);
        }

        for (const [route, label, opener] of states) {
          await state(page, who, view.name, route, label, opener, findings);
        }
      }

      await context.close();
      save();
    }

    if (view.name !== "dark") {
      const context = await browser.newContext({ baseURL, viewport: view.size, colorScheme: view.scheme });
      const page = await context.newPage();

      for (const route of open) await audit(page, "visitor", view.name, route, findings);
      await context.close();
      save();
    }
  }
});
