/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  GROUPS,
  MD,
  MODBY,
  MODS,
  TINT,
  ic,
} from "../site-data";
import {
  cellG,
  codeSt,
  liveChip,
  prevent,
  seg2,
  soonChip,
} from "./builder-helpers";
import type { SiteBuilderCtx } from "./builder-types";
import {
  buildTdProps,
  buildTl,
  dh,
  docTasks,
  sbFor,
  share,
  tdLinks,
  upNext,
} from "./module-detail-mock-data";

export function buildModules(ctx: SiteBuilderCtx): Record<string, any> {
  const { props: p, state: s, setS, go, isOn, ndS, lineS, rv } = ctx;

  const filt = s.filt ?? p.filter ?? "all";

  const rowFor = (x: any) => {
    const link = x[0] === "Tasks" || x[0] === "Docs";
    return {
      n: x[0],
      code: x[1],
      d: x[4],
      codeSt: codeSt(TINT[x[2]]),
      chipSt: x[3] ? liveChip : soonChip,
      chipT: x[3] ? "● Live" : "Coming",
      linkT: link ? "Details" : x[3] ? "" : "Roadmap",
      ar:
        link || !x[3]
          ? { ...ic("arrowR", 14), color: "currentColor" }
          : { display: "none" },
      go: link
        ? go("module", { modO: x[0].toLowerCase() })
        : x[3]
          ? prevent
          : go("roadmap"),
      rowSt: {
        display: "grid",
        gridTemplateColumns: "var(--mrCols)",
        alignItems: "center",
        gap: "12px 20px",
        padding: "18px 0",
        borderBottom: "1px solid var(--line2)",
        opacity: x[3] ? 1 : 0.55,
      },
      linkSt: {
        display: "var(--mlD)",
        alignItems: "center",
        gap: 6,
        justifyContent: "flex-end",
        fontSize: 14,
        color: link ? "var(--ink)" : "var(--ink2)",
        textDecoration: "none",
      },
    };
  };

  const mgroups = GROUPS.map((g: any, gi: any) => {
    const all = MODS.filter((x: any) => x[2] === g);
    const live = all.filter((x: any) => x[3]).length;
    const rows = all
      .filter((x: any) => filt === "all" || (filt === "live") === !!x[3])
      .map(rowFor);
    const k = "k" + (gi + 1);
    return {
      name: g,
      idx: "0" + (gi + 1),
      meta: `${live} modules`,
      rows,
      show: rows.length > 0,
      k,
      nd: ndS(isOn(k)),
      rvk: String(gi + 2),
      rv: rv["r" + (gi + 2)],
      br: {
        position: "absolute" as const,
        top: 38,
        left: "calc(var(--tx) - var(--px))",
        width: "calc(var(--px) - var(--tx) - 16px)",
        height: 1.5,
        ...lineS(isOn(k), "h"),
      },
    };
  });

  // module detail
  const mod = p.module ?? "tasks";
  const MDx = MD[mod] || MD.tasks;
  const lkOn = isOn("k2");
  const md = {
    ...MDx,
    codeSt: codeSt(TINT[MDx.group], 40),
    lkMeta: `${MDx.links.filter((l: any) => l[1]).length} live links · ${MDx.links.filter((l: any) => !l[1]).length} coming`,
  };

  const mdLinks = MDx.links.map(([n, live, t]: any) => {
    const x = MODBY[n] ?? (n === "Meetings" ? MODBY.Calendar : MODBY["Organization settings"])!;
    return {
      n,
      t,
      code: x[1],
      codeSt: codeSt(TINT[x[2]]),
      chipSt: live ? liveChip : soonChip,
      chipT: live ? "● Live" : "Coming",
      rowSt: {
        position: "relative" as const,
        display: "grid",
        gridTemplateColumns: "var(--lkRow)",
        alignItems: "center",
        gap: "12px 20px",
        padding: "18px 0",
        borderBottom: "1px solid var(--line2)",
        opacity: live ? 1 : 0.5,
      },
      ndSt: {
        position: "absolute" as const,
        left: -36.25,
        top: "calc(50% - 4.5px)",
        ...ndS(live && lkOn),
      },
    };
  });

  const lkLine = {
    position: "absolute" as const,
    left: 0,
    top: 20,
    bottom: 30,
    width: 1.5,
    ...lineS(lkOn, "v"),
  };

  const tl = buildTl();
  const tdProps = buildTdProps();

  return {
    filtSeg: [
      ["all", "All 18"],
      ["live", "Live 7"],
      ["coming", "Coming 11"],
    ].map(([k, l]: any) => ({
      l,
      st: seg2(filt === k),
      go: () => setS({ filt: k }),
    })),
    mgroups,
    md,
    isTasks: mod !== "docs",
    isDocs: mod === "docs",
    mdLinks,
    lkLine,
    mdPerm: MDx.perms.map(([a, v]: any) => ({
      mod: MDx.n,
      act: a,
      cells: v.map(cellG),
    })),
    roleNames: ["Owner", "Admin", "Member", "Guest"],
    sbNav: sbFor(mod === "docs" ? "docs" : "tasks"),
    tl,
    tdProps,
    tdLinks,
    upNext,
    dh,
    docTasks,
    share,
    tools: ["bold", "italic", "bullets", "checklist", "code", "link"].map(
      (k: any) => ic(k, 16),
    ),
  };
}
