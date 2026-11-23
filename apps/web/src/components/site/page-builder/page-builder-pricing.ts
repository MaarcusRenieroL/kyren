/* eslint-disable @typescript-eslint/no-explicit-any */
import { COMPARE, FAQ, MODS, PLANS, TINT, ic, mono } from "../site-data";
import { codeSt, seg2, tog } from "./builder-helpers";
import type { SiteBuilderCtx } from "./builder-types";

export function buildPricing(ctx: SiteBuilderCtx): Record<string, any> {
  const { props: p, state: s, setS, m } = ctx;

  const billing = s.billing ?? p.billing ?? "monthly";
  const yr = billing === "yearly";

  const bill = [
    ["monthly", "Monthly"],
    ["yearly", "Yearly"],
  ].map(([k, l]: any) => ({
    l,
    st: seg2(billing === k),
    go: () => setS({ billing: k }),
  }));

  const plans = PLANS.map(([n, d], i) => ({
    n,
    d,
    per: yr ? "per person / month, billed yearly" : "per person / month",
    note: yr ? "Yearly discount: TBD" : "Billed every month",
    colSt: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 20,
      padding: m ? "28px 0" : `36px 32px 40px ${i ? 32 : 0}px`,
      borderTop: m && i ? "1px solid var(--line2)" : "none",
      borderLeft: !m && i ? "1px solid var(--line2)" : "none",
    },
  }));

  const cols = m ? [s.planM] : [0, 1, 2];

  const cell = (v: any) =>
    v === "y"
      ? { st: ic("check", 18, "var(--ink)"), t: "" }
      : v === "tbd"
        ? {
            st: {
              fontFamily: mono,
              fontSize: 11,
              color: "var(--amber)",
              border: "1px dashed var(--amber)",
              borderRadius: 999,
              padding: "1px 8px",
            },
            t: "TBD",
          }
        : {
            st: { fontFamily: mono, fontSize: 12, color: "var(--ink2)" },
            t: v,
          };

  const soon = MODS.filter((x: any) => !x[3]);
  const addSel = soon.filter((x: any) => s.add[x[0]]).map((x: any) => x[0]);

  return {
    bill,
    billNote: yr ? "Yearly discount: TBD" : "Prices in USD · placeholder",
    plans,
    incl: [
      "All 7 live modules",
      "One search",
      "Roles & permissions",
      "Audit log",
    ],
    planTabs: PLANS.map((pl: any, i: any) => ({
      l: pl[0],
      st: seg2(s.planM === i),
      go: () => setS({ planM: i }),
    })),
    cmpHead: cols.map((i: any) => PLANS[i]![0]),
    cmpRows: COMPARE.map(([l, sub, v]: any) => ({
      l,
      sub,
      hasSub: !!sub,
      cells: cols.map((i: any) => cell(v[i])),
    })),
    addRows: soon.map((x: any) => ({
      n: x[0],
      code: x[1],
      d: x[4],
      codeSt: codeSt(TINT[x[2]]),
      ...tog(!!s.add[x[0]]),
      click: () =>
        setS((st0: any) => ({ add: { ...st0.add, [x[0]]: !st0.add[x[0]] } })),
    })),
    addSel,
    addNone: addSel.length === 0,
    addCount: `${addSel.length} add-on${addSel.length === 1 ? "" : "s"}`,
    faq: FAQ.map(([q, a], i) => ({
      q,
      a,
      open: s.faq === i,
      click: () => setS({ faq: s.faq === i ? -1 : i }),
      icSt: {
        ...ic("plus", 20, "var(--ink2)"),
        transform: s.faq === i ? "rotate(45deg)" : "none",
        transition: "transform .3s",
      },
    })),
  };
}
