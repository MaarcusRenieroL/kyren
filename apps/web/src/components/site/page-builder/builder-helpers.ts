/* eslint-disable @typescript-eslint/no-explicit-any */
import { PPL, ic, mono } from "../site-data";
import type { Mode, SitePageName } from "./builder-types";

export const prevent = (e?: any) => {
  if (e && e.preventDefault) e.preventDefault();
};

export const route = (k: string, extra?: any): string =>
  k === "home"
    ? "/"
    : k === "legal"
      ? (
          {
            privacy: "/privacy",
            terms: "/terms",
            cookies: "/cookies",
            dpa: "/dpa",
            subprocessors: "/subprocessors",
          } as Record<string, string>
        )[extra?.legalO ?? "privacy"]!
      : k === "module"
        ? `/modules/${extra?.modO ?? "tasks"}`
        : `/${k}`;

export const createGo = (router: any, setS: (u: any) => void) => {
  return (k: string, extra?: any) => {
    const href = route(k, extra);
    const fn: any = (e: any) => {
      prevent(e);
      setS({ menuO: false });
      router.push(href);
    };
    fn.href = href;
    return fn;
  };
};

export const seg = (a: any) => ({
  height: 28,
  padding: "0 12px",
  borderRadius: 99,
  border: "none",
  cursor: "pointer",
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  background: a ? "var(--ink)" : "transparent",
  color: a ? "var(--bg)" : "var(--ink2)",
});

export const seg2 = (a: any) => ({
  ...seg(a),
  height: 34,
  padding: "0 16px",
  fontSize: 12,
});

export const thB = (a: any) => ({
  width: 30,
  height: 30,
  padding: 0,
  borderRadius: 99,
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: a ? "var(--ink)" : "transparent",
  color: a ? "var(--bg)" : "var(--ink2)",
  transition: "background .2s, color .2s",
});

export const codeSt = (tint: any, s0 = 32) => ({
  width: s0,
  height: s0,
  borderRadius: 9,
  flex: "none",
  background: tint,
  border: "1px solid var(--line2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: mono,
  fontSize: 11,
  fontWeight: 500,
  color: "var(--ink)",
});

export const liveChip = {
  fontFamily: mono,
  fontSize: 11,
  color: "var(--green)",
  whiteSpace: "nowrap",
};

export const soonChip = {
  fontFamily: mono,
  fontSize: 11,
  color: "var(--ink2)",
  border: "1px dashed var(--ink3)",
  borderRadius: 999,
  padding: "2px 9px",
  whiteSpace: "nowrap",
  justifySelf: "start",
};

export const tog = (on: any) => ({
  track: {
    flex: "none",
    width: 36,
    height: 20,
    borderRadius: 99,
    position: "relative",
    cursor: "pointer",
    background: on ? "var(--ink)" : "var(--line)",
    transition: "background .2s",
  },
  knob: {
    position: "absolute",
    top: 2,
    left: on ? 18 : 2,
    width: 16,
    height: 16,
    borderRadius: 99,
    background: on ? "var(--bg)" : "var(--tile)",
    boxShadow: "var(--knob-shadow)",
    transition: "left .2s",
  },
});

export const glyph = (stt: any) => {
  const c = {
    prog: "var(--amber)",
    review: "var(--cyan)",
    todo: "var(--ink3)",
    done: "var(--green)",
  }[stt as "prog"];
  const b = {
    width: 14,
    height: 14,
    borderRadius: 99,
    flex: "none",
    boxSizing: "border-box",
  };
  if (stt === "done") return { ...b, background: c };
  if (stt === "todo") return { ...b, border: `1.5px solid ${c}` };
  return {
    ...b,
    border: `1.5px solid ${c}`,
    padding: 2,
    backgroundClip: "content-box",
    backgroundImage: `conic-gradient(${c} 0 ${stt === "prog" ? 50 : 75}%, transparent 0)`,
  };
};

export const av = (code: any, size = 24) => ({
  width: size,
  height: size,
  flex: "none",
  borderRadius: 99,
  background: (PPL[code] || [0, "var(--tile2)"])[1],
  border: "1px solid var(--line)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: mono,
  fontSize: 9,
  color: "var(--ink)",
});

export const pill = (c: any) => ({
  fontFamily: mono,
  fontSize: 11,
  padding: "3px 9px",
  borderRadius: 999,
  color: c,
  background: `color-mix(in oklab, ${c} 15%, transparent)`,
  whiteSpace: "nowrap",
});

export const cellG = (v: any) => ({
  g:
    v === 2
      ? {
          width: 10,
          height: 10,
          borderRadius: 99,
          background: "var(--ink)",
        }
      : v
        ? {
            fontFamily: mono,
            fontSize: 10,
            color: "var(--ink2)",
            border: "1px solid var(--line)",
            borderRadius: 99,
            padding: "1px 7px",
          }
        : {
            width: 10,
            height: 1.5,
            background: "var(--ink3)",
            opacity: 0.6,
          },
  t: v === 1 ? "own" : v === 3 ? "shared" : "",
});
