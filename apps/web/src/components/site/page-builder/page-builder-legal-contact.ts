/* eslint-disable @typescript-eslint/no-explicit-any */
import { LEGAL, ic } from "../site-data";
import { seg2 } from "./builder-helpers";
import type { SiteBuilderCtx } from "./builder-types";

export function buildLegalContact(ctx: SiteBuilderCtx): Record<string, any> {
  const { props: p, state: s, setS, go } = ctx;

  // legal
  const doc = p.doc ?? "privacy";
  const L = (LEGAL[doc] || LEGAL.privacy)!;
  const legalTabs = Object.keys(LEGAL).map((k: any) => ({
    l: LEGAL[k]!.tab,
    st: seg2(doc === k),
    go: go("legal", { legalO: k }),
  }));

  const toc = L.secs.map(({ t }, i: any) => ({
    t,
    n: String(i + 1).padStart(2, "0"),
    go: () => setS({ toc: i, tocOpen: false }),
    st: {
      display: "flex",
      gap: 12,
      alignItems: "baseline",
      padding: "7px 0 7px 12px",
      borderLeft:
        s.toc === i
          ? "1.5px solid var(--accent)"
          : "1.5px solid var(--line2)",
      color: s.toc === i ? "var(--ink)" : "var(--ink2)",
      fontSize: 14,
      cursor: "pointer",
      background: "none",
      borderTop: "none",
      borderRight: "none",
      borderBottom: "none",
      textAlign: "left" as const,
    },
  }));

  const secs = L.secs.map(({ t, paras }, i: any) => ({
    t,
    n: String(i + 1).padStart(2, "0"),
    paras,
  }));

  return {
    L,
    legalTabs,
    toc,
    secs,
    tocOpen: s.tocOpen,
    toggleToc: () => setS({ tocOpen: !s.tocOpen }),
    tocLabel: `On this page · ${L.secs.length} sections`,
    tocChev: {
      ...ic("chev", 16, "var(--ink2)"),
      transform: s.tocOpen ? "rotate(180deg)" : "none",
    },
  };
}
