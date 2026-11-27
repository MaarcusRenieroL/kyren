"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// The marketing site pages (Modules, Module, Pricing, Roadmap, Security,
// Changelog, Legal, About, Status). One shared shell, thread and scroll state;
// the markup is in site-template.tsx and the content in site-data.ts.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@kyren/auth/client";
import { clamp } from "./site-data";
import { SiteTemplate } from "./site-template";
import { buildSitePageVals } from "./page-builder/build-site-page-vals";
import type {
  Mode,
  SitePageName,
  SitePageProps,
} from "./page-builder/builder-types";

export type { SitePageName } from "./page-builder/builder-types";

type Props = SitePageProps;

// Shared with the landing page so the theme carries across.
const storageKey = "kyren-landing-theme";

const initialState = {
  P: null as number | null,
  vw: null as number | null,
  on: null as Record<string, boolean> | null,
  rv: null as Record<string, boolean> | null,
  billing: null as string | null,
  planM: 1,
  add: { Chat: 1, Calendar: 1 } as Record<string, number>,
  faq: 0,
  filt: null as string | null,
  notify: {} as Record<string, boolean>,
  cl: "All",
  menuO: null as boolean | null,
  toc: 0,
  tocOpen: false,
  f: { name: "", email: "", topic: "", msg: "" },
  touched: {} as Record<string, number>,
  submitted: false,
  sent: false,
};

export function SitePage(props: Props) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void authClient
      .getSession()
      .then(({ data }) => setSignedIn(Boolean(data)))
      .catch(() => undefined);
  }, []);

  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const lastKey = useRef("");
  const [state, setState] = useState<any>(initialState);
  const [mode, setMode] = useState<Mode>("dark");
  const [sysLight, setSysLight] = useState(false);
  const [rm, setRm] = useState(false);

  const setS = useCallback(
    (update: any) =>
      setState((prev: any) => ({
        ...prev,
        ...(typeof update === "function" ? update(prev) : update),
      })),
    [],
  );

  const chooseMode = (next: Mode) => {
    setMode(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Not remembered, still switched.
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark" || saved === "system") {
        setMode(saved);
      }
    } catch {
      // Storage can be blocked; dark is the default.
    }

    const light = window.matchMedia("(prefers-color-scheme: light)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setSysLight(light.matches);
      setRm(reduce.matches);
    };

    update();
    light.addEventListener("change", update);
    reduce.addEventListener("change", update);

    return () => {
      light.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);

  // One scroll value drives the Thread; each node lights as the line reaches it.
  const tick = useCallback(() => {
    const root = rootRef.current;
    const line = lineRef.current;
    if (!root) return;

    const ih = window.innerHeight;
    const box = root.getBoundingClientRect();
    const P = clamp((ih * 0.6 - box.top) / Math.max(1, box.height - ih * 0.4));
    const rv: Record<string, boolean> = {};
    const on: Record<string, boolean> = {};

    root.querySelectorAll<HTMLElement>("[data-rv]").forEach((el) => {
      rv["r" + el.dataset.rv] = el.getBoundingClientRect().top < ih * 0.88;
    });

    if (line) {
      const lr = line.getBoundingClientRect();
      const limit = lr.top + P * lr.height + 2;

      root.querySelectorAll<HTMLElement>("[data-nd]").forEach((el) => {
        on[el.dataset.nd!] = el.getBoundingClientRect().top <= limit;
      });
    }

    const vw = root.offsetWidth;
    const key = JSON.stringify([rv, on, vw]);

    setState((prev: any) => {
      if (
        key === lastKey.current &&
        prev.P !== null &&
        Math.abs(P - prev.P) <= 0.002
      ) {
        return prev;
      }
      lastKey.current = key;
      return { ...prev, P, rv, on, vw };
    });
  }, []);

  useEffect(() => {
    const onScroll = () => tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    requestAnimationFrame(onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [tick]);

  // Filters and tabs change the page height, so the nodes are measured again.
  useEffect(() => {
    requestAnimationFrame(tick);
  }, [state.filt, state.cl, props.page, props.module, props.doc, tick]);

  const vals = buildSitePageVals({
    props,
    state,
    setState,
    setS,
    mode,
    sysLight,
    rm,
    router,
    rootRef,
    lineRef,
    chooseMode,
  });

  // Signed in already: "Open Kyren" instead of "Sign in" / "Get started".
  return <SiteTemplate v={{ ...vals, signedIn }} />;
}
