import { useCallback, useEffect, useState, type RefObject } from "react";
import { clamp, ease } from "./landing-styles";

export function useLandingScroll(rootRef: RefObject<HTMLDivElement | null>) {
  const [P, setP] = useState(0);
  const [vw, setVw] = useState(1440);
  const [reduced, setReduced] = useState(false);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const box = root.getBoundingClientRect();
    const inner = window.innerHeight;

    setP(
      clamp((inner * 0.6 - box.top) / Math.max(1, box.height - inner * 0.4)),
    );
    setVw(root.offsetWidth);
  }, [rootRef]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");

    setReduced(query.matches);
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>(
        [
          "h2",
          "h2 + p",
          "#product [data-rv]",
          "#modules h3",
          "#modules .l-lift",
          "#modules [data-dim]",
          "#control [data-rv]",
          "#control [role=row]",
          "#control li",
          "[data-rv]",
        ].join(","),
      ),
    );
    const items = Array.from(new Set(targets)).map((el) => {
      const siblings = el.parentElement
        ? Array.from(el.parentElement.children)
        : [];

      el.classList.add("l-rv");

      return { el, order: Math.min(siblings.indexOf(el), 6), last: -1 };
    });
    let frame = 0;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;

      for (const item of items) {
        const top = item.el.getBoundingClientRect().top + item.order * 26;
        const t = ease(clamp((vh * 0.98 - top) / (vh * 0.3)));

        if (Math.abs(t - item.last) > 0.004) {
          item.last = t;
          item.el.style.setProperty("--rv", t.toFixed(3));
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);

      for (const item of items) {
        item.el.classList.remove("l-rv");
        item.el.style.removeProperty("--rv");
      }
    };
  }, [reduced, rootRef]);

  return { P, vw, reduced };
}
