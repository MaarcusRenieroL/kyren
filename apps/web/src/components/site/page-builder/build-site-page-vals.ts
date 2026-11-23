/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RefObject } from "react";
import { clamp } from "../site-data";
import { createGo } from "./builder-helpers";
import type { Mode, SiteBuilderCtx, SitePageProps, SiteState } from "./builder-types";
import { buildLegalContact } from "./page-builder-legal-contact";
import { buildModules } from "./page-builder-modules";
import { buildNavAndShell } from "./page-builder-nav";

export interface BuildSitePageValsParams {
  props: SitePageProps;
  state: SiteState;
  setState: (update: any) => void;
  setS: (update: any) => void;
  mode: Mode;
  sysLight: boolean;
  rm: boolean;
  router: any;
  rootRef: RefObject<HTMLDivElement | null>;
  lineRef: RefObject<HTMLDivElement | null>;
  chooseMode: (next: Mode) => void;
}

export function buildSitePageVals(params: BuildSitePageValsParams): Record<string, any> {
  const {
    props,
    state,
    setS,
    mode,
    sysLight,
    rm,
    router,
    rootRef,
    lineRef,
    chooseMode,
  } = params;

  const st = false;
  const theme: "light" | "dark" =
    mode === "system" ? (sysLight ? "light" : "dark") : mode;
  const m = !!props.mobile || (!st && (state.vw ?? 1440) < 1000);
  const P = st ? (props.progress ?? 1) : (state.P ?? 0);
  const isOn = (k: any) => P >= 0.999 || !!(state.on && state.on[k]);

  const ndS = (o: any) => ({
    display: "block",
    width: 9,
    height: 9,
    borderRadius: 999,
    boxSizing: "border-box" as const,
    background: o ? "var(--accent)" : "var(--bg)",
    border: o ? "none" : "1.5px solid var(--track)",
    boxShadow: o
      ? "0 0 0 4px color-mix(in oklab, var(--accent) 20%, transparent), var(--glow)"
      : "none",
    transition: "all .3s",
  });

  const lineS = (o: any, dir: any) =>
    o
      ? { background: "var(--accent)", boxShadow: "var(--glow)" }
      : {
          backgroundImage: `repeating-linear-gradient(${dir === "h" ? "to right" : "to bottom"}, var(--track) 0 4px, transparent 4px 9px)`,
        };

  const ease = "cubic-bezier(.2,.7,.2,1)";
  const rvS = (o: any) =>
    st || rm
      ? {}
      : o
        ? {
            opacity: 1,
            transform: "none",
            transition: `opacity .8s ${ease}, transform .8s ${ease}`,
          }
        : {
            opacity: 0,
            transform: "translateY(32px) scale(.98)",
            transition: `opacity .5s ${ease}, transform .5s ${ease}`,
          };

  const rvOn = (i: any) => !state.rv || state.rv["r" + i] !== false;
  const rv: Record<string, any> = {};
  for (let i = 0; i < 40; i++) rv["r" + i] = rvS(rvOn(i));

  const go = createGo(router, setS);
  const gos = Object.fromEntries(
    [
      "pricing",
      "modules",
      "roadmap",
      "security",
      "changelog",
      "legal",
      "about",
      "status",
    ].map((k: any) => [k, go(k)]),
  );

  const ctx: SiteBuilderCtx = {
    props,
    state,
    setS,
    mode,
    sysLight,
    rm,
    router,
    rootRef,
    lineRef,
    chooseMode,
    go,
    gos,
    theme,
    m,
    P,
    isOn,
    ndS,
    lineS,
    rv,
  };

  return {
    ...buildNavAndShell(ctx),
    ...(props.page === "module" || props.page === "modules" ? buildModules(ctx) : {}),
    ...(props.page === "legal" ? buildLegalContact(ctx) : {}),
  };
}
