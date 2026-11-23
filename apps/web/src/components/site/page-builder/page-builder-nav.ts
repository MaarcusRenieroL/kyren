/* eslint-disable @typescript-eslint/no-explicit-any */
import { LD, LM, MODS, ic } from "../site-data";
import { prevent, thB } from "./builder-helpers";
import type { SiteBuilderCtx } from "./builder-types";

export function buildNavAndShell(ctx: SiteBuilderCtx): Record<string, any> {
  const {
    props: p,
    state: s,
    mode,
    rootRef,
    lineRef,
    setS,
    chooseMode,
    go,
    gos,
    theme,
    m,
    P,
    isOn,
    ndS,
    rv,
  } = ctx;

  const page = p.page;
  const only = p.only || "all";
  const quiet = ["legal", "status", "about"].includes(page);
  const endOn = P >= 0.985;
  const act = page === "module" ? "modules" : page;

  const navLinks = [
    ["modules", "Modules"],
    ["pricing", "Pricing"],
    ["roadmap", "Roadmap"],
    ["security", "Security"],
    ["changelog", "Changelog"],
  ].map(([k, t]: any) => ({
    t,
    go: go(k),
    st: {
      color: act === k ? "var(--ink)" : "var(--ink2)",
      fontSize: 14,
      fontWeight: act === k ? 500 : 400,
      textDecoration: "none",
      boxShadow: act === k ? "0 1px 0 var(--ink)" : "none",
    },
  }));

  const menuLinks = [
    ["home", "Product"],
    ["modules", "Modules"],
    ["pricing", "Pricing"],
    ["roadmap", "Roadmap"],
    ["security", "Security"],
    ["changelog", "Changelog"],
    ["about", "About & contact"],
    ["status", "Status"],
  ].map(([k, t]: any, i: any) => ({
    t,
    i: "0" + (i + 1),
    go: go(k),
    ar: { ...ic("fwd", 16), color: "var(--ink3)" },
    st: {
      display: "flex",
      alignItems: "center",
      height: 56,
      borderBottom: "1px solid var(--line2)",
      color: act === k ? "var(--accent)" : "var(--ink)",
      fontFamily: "'Bricolage Grotesque',sans-serif",
      fontWeight: 700,
      fontSize: 24,
      letterSpacing: "-0.03em",
      textDecoration: "none",
    },
  }));

  const menuOn = m && (s.menuO ?? !!p.menuOpen);
  const legalGo = (k: string) => go("legal", { legalO: k });
  const soon = MODS.filter((x: any) => !x[3]);

  const nd: Record<string, any> = {};
  for (let i = 0; i < 12; i++) {
    const k = "k" + i;
    nd[k] = quiet && i > 0 ? { display: "none" } : ndS(isOn(k));
  }

  const track = quiet
    ? { position: "absolute", inset: 0, background: "var(--line2)" }
    : {
        position: "absolute",
        inset: 0,
        backgroundImage:
          "repeating-linear-gradient(to bottom, var(--track) 0 4px, transparent 4px 10px)",
      };

  const fill = quiet
    ? { display: "none" }
    : {
        position: "absolute",
        inset: 0,
        background: "var(--accent)",
        boxShadow: "var(--glow)",
        transformOrigin: "top",
        transform: `scaleY(${P})`,
        transition: "transform .25s linear",
      };

  const closeCopy: Record<string, any> = {
    pricing: [
      "Explore the modules and decide which ones fit your team.",
      "See the modules",
      "modules",
    ],
    modules: [
      "Projects, Tasks, Docs, Teams, roles, the audit log and module settings are live today.",
      "See the roadmap",
      "roadmap",
    ],
    module: [
      "Manage projects, tasks and documents in one organization.",
      "All modules",
      "modules",
    ],
    roadmap: [
      "Explore the current workspace modules.",
      "See the modules",
      "modules",
    ],
    security: [
      "Invite your team and choose who can do what before anyone creates a task.",
      "About Kyren",
      "about",
    ],
    changelog: [
      "Feature availability depends on your deployment and enabled modules.",
      "See the roadmap",
      "roadmap",
    ],
  };
  const cc = closeCopy[page];
  const showMain = only === "all";

  return {
    rootRef,
    lineRef,
    rootClass: theme === "light" ? "landing-light" : "landing-dark",
    m,
    notM: !m,
    rootStyle: {
      ...(m ? LM : LD),
      position: "relative" as const,
      overflowX: "clip" as const,
      background: "var(--bg)",
      color: "var(--ink)",
      fontFamily: "var(--font-geist), system-ui, sans-serif",
      WebkitFontSmoothing: "antialiased" as const,
      minHeight: only === "nav" && menuOn ? 844 : undefined,
    },
    showNav: only === "all" || only === "nav",
    showMain,
    showFooter: only === "all" || only === "footer",
    showClose: showMain && !!cc && page !== "pricing",
    menuOn,
    pg: {
      pricing: page === "pricing",
      modules: page === "modules",
      module: page === "module",
      roadmap: page === "roadmap",
      security: page === "security",
      changelog: page === "changelog",
      legal: page === "legal",
      about: page === "about",
      status: page === "status",
    },
    cl: {
      pricing: page === "pricing",
      modules: page === "modules",
      module: page === "module",
      roadmap: page === "roadmap",
      security: page === "security",
      changelog: page === "changelog",
    },
    closeLead: cc ? cc[0] : "",
    close2: { t: cc ? cc[1] : "", go: cc ? go(cc[2]) : prevent },
    nd,
    rv,
    track,
    fill,
    fillEnd: quiet
      ? { display: "none" }
      : {
          position: "absolute" as const,
          inset: 0,
          background: "var(--accent)",
          boxShadow: "var(--glow)",
          transformOrigin: "top",
          transform: `scaleY(${endOn ? 1 : 0})`,
          transition: "transform .4s",
        },
    endNode: {
      width: 14,
      height: 14,
      borderRadius: 99,
      boxSizing: "border-box" as const,
      background: endOn ? "var(--accent)" : "var(--bg)",
      border: endOn ? "none" : "1.5px solid var(--track)",
      boxShadow: endOn
        ? "0 0 0 6px color-mix(in oklab, var(--accent) 22%, transparent), 0 0 24px var(--accent)"
        : "none",
      transition: "all .3s",
    },
    th: {
      light: thB(mode === "light"),
      dark: thB(mode === "dark"),
      sys: thB(mode === "system"),
    },
    thIc: {
      light: ic("sun", 15),
      dark: ic("moon", 15),
      sys: ic("monitor", 15),
    },
    setLight: () => chooseMode("light"),
    setDark: () => chooseMode("dark"),
    setSys: () => chooseMode("system"),
    toggleMenu: () => setS({ menuO: !menuOn }),
    menuIc: ic(menuOn ? "x" : "menu", 18),
    go: gos,
    navLinks,
    menuLinks,
    footProduct: [
      ["modules", "Modules"],
      ["pricing", "Pricing"],
      ["roadmap", "Roadmap"],
      ["changelog", "Changelog"],
      ["status", "Status"],
    ].map(([k, t]: any) => ({ t, go: go(k) })),
    footCompany: [
      ["about", "About"],

      ["security", "Security"],
    ].map(([k, t]: any) => ({ t, go: go(k) })),
    footLegal: [
      ["privacy", "Privacy"],
      ["terms", "Terms"],
      ["cookies", "Cookies"],
      ["dpa", "DPA"],
      ["subprocessors", "Subprocessors"],
    ].map(([k, t]: any) => ({ t, go: legalGo(k) })),
    footLive: MODS.filter((x: any) => x[3]).map((x: any) => ({
      t: x[0],
      go:
        x[0] === "Tasks" || x[0] === "Docs"
          ? go("module", { modO: x[0].toLowerCase() })
          : go("modules"),
    })),
    footSoon: soon.map((x: any) => x[0]),
    ico: {
      check: ic("check", 16, "var(--ink)"),
      checkInv: ic("check", 12, "var(--bg)"),
      list: ic("list", 14),
      board: ic("board", 14),
      plus: ic("plus", 14),
      search: ic("search", 14),
      docs: ic("docs", 14),
      bell: ic("bell", 16),
      alert: ic("alert", 16, "var(--rose)"),
      chev: ic("chev", 16, "var(--ink2)"),
      arrow: ic("arrowR", 14),
    },
  };
}
