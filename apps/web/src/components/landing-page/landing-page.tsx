"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ATTACHMENTS,
  CHIPS,
  HORIZONTAL,
  KEYS,
  LD,
  LM,
  type ThreadKey,
} from "./landing-data";
import {
  clamp,
  ease,
  nodeStyle,
  storageKey,
  type Mode,
} from "./landing-styles";
import { useLandingScroll } from "./use-landing-scroll";
import { LandingHeader } from "./landing-header";
import { LandingFooter } from "./landing-footer";
import { HeroSection } from "./sections/hero-section";
import { ModulesSwitchboardSection } from "./sections/modules-switchboard-section";
import { AttachedSection } from "./sections/attached-section";
import { ModulesCatalogSection } from "./sections/modules-catalog-section";
import { ControlSection } from "./sections/control-section";
import { CtaSection } from "./sections/cta-section";

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("dark");
  const [sysLight, setSysLight] = useState(false);
  const [tick, setTick] = useState(0);
  const [ringIn, setRingIn] = useState(false);
  const [pulseAt, setPulseAt] = useState(0);

  const { P, vw, reduced } = useLandingScroll(rootRef);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark" || saved === "system") {
        setMode(saved);
      }
    } catch {
      // Storage blocked; default dark
    }

    const query = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setSysLight(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduced) return;
    setRingIn(true);
    const clock = setInterval(() => setTick((v) => v + 1), 1000);
    const walk = setInterval(() => setPulseAt((v) => (v + 1) % 4), 2200);
    return () => {
      clearInterval(clock);
      clearInterval(walk);
    };
  }, [reduced]);

  const chooseMode = (next: Mode) => {
    setMode(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Ignore
    }
  };

  const theme = mode === "system" ? (sysLight ? "light" : "dark") : mode;
  const m = vw < 1100;
  const progress = reduced ? 1 : P;
  const trans = reduced ? "none" : undefined;

  const f = useMemo(() => {
    const out = {} as Record<ThreadKey, number>;
    KEYS.forEach((key, i) => {
      out[key] = clamp(progress * KEYS.length - i);
    });
    return out;
  }, [progress]);

  const fill = (key: ThreadKey): CSSProperties => {
    const h = HORIZONTAL[key];
    return {
      position: "absolute",
      inset: 0,
      background: "var(--accent)",
      boxShadow: "var(--glow)",
      transformOrigin: h ?? "top",
      transform: h ? `scaleX(${f[key]})` : `scaleY(${f[key]})`,
      transition: trans ?? "transform .25s linear",
    };
  };

  const node = (key: ThreadKey) => nodeStyle(f[key] > 0.001);

  const sc = m ? 0.78 : 1;
  const W = m ? 326 : 440;
  const LY = m ? 140 : 200;
  const chipH = 34 * sc;
  const gap = 6 * sc;
  const merged: Array<[number, number]> = [];

  [
    [0, 5],
    [5, 10],
  ].forEach(([a, b], row) => {
    const widths = CHIPS.slice(a!, b).map((c) => c[1] * sc);
    let x =
      W - (widths.reduce((sum, w) => sum + w, 0) + gap * 4) - (m ? 4 : 36);
    widths.forEach((w) => {
      merged.push([x, row ? LY + 2 : LY - chipH - 2]);
      x += w + gap;
    });
  });

  const ce = ease(f.s2b);
  const rootVars = { ...(m ? LM : LD) } as CSSProperties;

  let attached = 0;
  const attOn = ATTACHMENTS.map((_, i) => {
    const on = f.s3a >= (i + 1) / 6;
    if (on) attached += 1;
    return on;
  });

  const endOn = f.s6c >= 0.999;
  const auditProgress = m ? f.s5 : f.s5x;
  const mx = 2;
  const base = 1 * 3600 + 24 * 60 + 36 + tick;
  const timer = [
    Math.floor(base / 3600),
    Math.floor((base % 3600) / 60),
    base % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  const ringPct = reduced || ringIn ? 62.5 : 0;
  const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

  return (
    <div
      ref={rootRef}
      className={theme === "light" ? "landing-light" : "landing-dark"}
      style={{
        ...rootVars,
        position: "relative",
        overflowX: "clip",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-geist), system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        minHeight: "100vh",
      }}
    >
      <LandingHeader
        m={m}
        mode={mode}
        theme={theme}
        chooseMode={chooseMode}
      />

      <main>
        <HeroSection
          fill={fill}
          node={node}
          rise={rise}
          timer={timer}
          ringPct={ringPct}
          reduced={reduced}
          pulseAt={pulseAt}
        />

        <ModulesSwitchboardSection
          fill={fill}
          node={node}
          m={m}
          ce={ce}
          merged={merged}
          sc={sc}
          trans={trans}
        />

        <AttachedSection
          fill={fill}
          attached={attached}
          m={m}
          attOn={attOn}
          trans={trans}
        />

        <ModulesCatalogSection
          fill={fill}
          f={f}
          m={m}
        />

        <ControlSection
          fill={fill}
          mx={mx}
          trans={trans}
          m={m}
          auditProgress={auditProgress}
        />

        <CtaSection
          fill={fill}
          endOn={endOn}
          trans={trans}
        />
      </main>

      <LandingFooter
        mode={mode}
        chooseMode={chooseMode}
      />
    </div>
  );
}
