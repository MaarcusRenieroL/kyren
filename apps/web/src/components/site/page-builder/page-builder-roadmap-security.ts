/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AUDIT,
  CHAIN,
  CL,
  CLCHIP,
  COMP,
  GROUPS,
  INC,
  MATRIX,
  MODS,
  PREV,
  ROLES,
  TINT,
  mono,
} from "../site-data";
import { cellG, codeSt, pill } from "./builder-helpers";
import type { SiteBuilderCtx } from "./builder-types";

export function buildRoadmapSecurityStatus(ctx: SiteBuilderCtx): Record<string, any> {
  const { props: p, state: s, setS, isOn, ndS, lineS, rv } = ctx;

  const soon = MODS.filter((x: any) => !x[3]);
  const notifiedP = (p.notified || "")
    .split(",")
    .map((x: any) => x.trim())
    .filter(Boolean);
  const isN = (n: any) => !!s.notify[n] || notifiedP.includes(n);

  const rmGroups = GROUPS.map((g: any, gi: any) => {
    const k = "k" + (gi + 1);
    return {
      name: g,
      idx: "0" + (gi + 1),
      k,
      nd: ndS(isOn(k)),
      rvk: String(gi + 1),
      rv: rv["r" + (gi + 1)],
      br: {
        position: "absolute" as const,
        top: 38,
        left: "calc(var(--tx) - var(--px))",
        width: "calc(var(--px) - var(--tx) - 16px)",
        height: 1.5,
        ...lineS(isOn(k), "h"),
      },
      meta: `${soon.filter((x: any) => x[2] === g).length} coming`,
      rows: soon
        .filter((x: any) => x[2] === g)
        .map((x: any) => ({
          n: x[0],
          code: x[1],
          d: x[4],
          codeSt: codeSt(TINT[g], 40),
          url: "fernway.kyren.example / " + x[0].toLowerCase(),
          prev: PREV[x[0]!]!.map(([a, b]: any) => ({ a, b })),
          isN: isN(x[0]),
          notN: !isN(x[0]),
          click: () =>
            setS((st0: any) => ({
              notify: { ...st0.notify, [x[0]]: !st0.notify[x[0]] },
            })),
          done: `We’ll email you when ${x[0]} is live.`,
        })),
    };
  }).filter((g: any) => g.rows.length);

  const allN = soon.every((x: any) => isN(x[0]));

  // security
  const secRoles = ROLES.map(([n, d], i) => ({ n, d, idx: "0" + (i + 1) }));
  const secMatrix = MATRIX.map(([mod0, a, v]: any) => ({
    mod: mod0,
    act: a,
    cells: v.map(cellG),
  }));
  const chain = CHAIN.map(([t, d], i) => ({
    t,
    d,
    i: String(i + 1),
    ndSt: {
      position: "absolute" as const,
      left: -36.25,
      top: 24,
      ...ndS(isOn("k2")),
    },
  }));
  const chainLine = {
    position: "absolute" as const,
    left: 0,
    top: 28,
    bottom: 40,
    width: 1.5,
    ...lineS(isOn("k2"), "v"),
  };

  const tagSt = (mod0: any) => {
    const g = CLCHIP[mod0];
    return {
      fontFamily: mono,
      fontSize: 11,
      color: "var(--ink)",
      background: g ? TINT[g] : "var(--chip-bg)",
      border: "1px solid var(--line2)",
      borderRadius: 999,
      padding: "3px 10px",
      whiteSpace: "nowrap" as const,
      justifySelf: "start" as const,
      alignSelf: "start" as const,
    };
  };

  const audit = AUDIT.map(([t, w, a, mod0]: any) => ({
    t,
    w,
    a,
    mod: mod0,
    tag: tagSt(mod0),
  }));

  // changelog
  const clF = s.cl;
  const clChips = [
    "All",
    "Projects",
    "Tasks",
    "Docs",
    "Teams",
    "Roles",
    "Audit log",
    "Modules",
    "Workspace",
  ].map((c: any) => ({
    l: c,
    go: () => setS({ cl: c }),
    st: {
      height: 32,
      padding: "0 14px",
      borderRadius: 999,
      cursor: "pointer",
      fontFamily: mono,
      fontSize: 12,
      border: clF === c ? "1px solid var(--ink)" : "1px solid var(--line)",
      background: clF === c ? "var(--ink)" : "transparent",
      color: clF === c ? "var(--bg)" : "var(--ink2)",
    },
  }));

  const entries = CL.map((e: any, i: any) => ({
    d: e[0],
    t: e[1],
    x: e[2],
    mod: e[3],
    tag: tagSt(e[3]),
    k: "c" + i,
    nd: ndS(isOn("c" + i)),
    rvk: String(i + 2),
    rv: rv["r" + (i + 2)],
  })).filter((e: any) => clF === "All" || e.mod === clF);

  // status
  const inc = (p.statusState ?? "ok") === "incident";
  const comps = COMP.map((n: any) => {
    const bad = inc && n === "Search";
    return {
      n,
      s: bad ? "Degraded performance" : "Operational",
      dot: {
        width: 8,
        height: 8,
        borderRadius: 99,
        flex: "none",
        background: bad ? "var(--amber)" : "var(--green)",
      },
      tSt: {
        fontFamily: mono,
        fontSize: 12,
        color: bad ? "var(--amber)" : "var(--ink2)",
        whiteSpace: "nowrap" as const,
      },
    };
  });

  const stDot = {
    width: 14,
    height: 14,
    borderRadius: 99,
    flex: "none",
    background: inc ? "var(--amber)" : "var(--green)",
    boxShadow: `0 0 0 6px color-mix(in oklab, ${inc ? "var(--amber)" : "var(--green)"} 18%, transparent)`,
  };

  const incUpd = INC.map(([t, s0, x], i) => ({
    t,
    s: s0,
    x,
    st: pill(i === 0 ? "var(--cyan)" : "var(--amber)"),
  }));

  return {
    rmGroups,
    notifyAll: () =>
      setS({
        notify: Object.fromEntries(soon.map((x: any) => [x[0], !allN])),
      }),
    notifyAllT: allN
      ? "Notifying you about all 11"
      : "Notify me about all 11",
    secRoles,
    secMatrix,
    chain,
    chainLine,
    audit,
    clChips,
    entries,
    clEmpty: entries.length === 0,
    inc,
    ok: !inc,
    comps,
    stDot,
    incUpd,
  };
}
