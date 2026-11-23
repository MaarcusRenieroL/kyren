import { Button } from "@zentro/ui/shadcn/button";
import type { CSSProperties, ReactNode } from "react";

export const DISPLAY = "var(--font-bricolage), var(--font-geist), sans-serif";
export const MONO = "var(--font-geist-mono), ui-monospace, monospace";
export const SERIF = "var(--font-instrument-serif), Georgia, serif";
export const storageKey = "zentro-landing-theme";

export type Mode = "dark" | "light" | "system";

export const clamp = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const dashed = (dir: "h" | "v"): CSSProperties => ({
  backgroundImage: `repeating-linear-gradient(${dir === "h" ? "to right" : "to bottom"}, var(--track) 0 4px, transparent 4px 10px)`,
});

export const solidLine: CSSProperties = {
  background: "var(--accent)",
  boxShadow: "var(--glow)",
};

export const nodeStyle = (on: boolean): CSSProperties => ({
  display: "block",
  width: 9,
  height: 9,
  borderRadius: 999,
  boxSizing: "border-box",
  background: on ? "var(--accent)" : "var(--bg)",
  border: on ? "none" : "1.5px solid var(--track)",
  boxShadow: on
    ? "0 0 0 4px color-mix(in oklab, var(--accent) 20%, transparent), var(--glow)"
    : "none",
  transition: "all .3s",
});

export const label: CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};

export const stateChip = (color: string): CSSProperties => ({
  fontFamily: MONO,
  fontSize: 11,
  padding: "3px 9px",
  borderRadius: 999,
  color,
  background: `color-mix(in oklab, ${color} 15%, transparent)`,
});

export const accentWord: CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontWeight: 400,
  fontSize: "1.1em",
  letterSpacing: "-0.01em",
};

export const primaryPill = (
  h: number,
  px: number,
  size: number,
): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: h,
  padding: `0 ${px}px`,
  borderRadius: 999,
  background: "var(--btn)",
  color: "var(--btn-ink)",
  fontSize: size,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  boxShadow: "var(--btn-shadow)",
  textDecoration: "none",
  transition: "all .15s ease",
  cursor: "pointer",
});

export const ghostPill = (
  h: number,
  px: number,
  size: number,
): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: h,
  padding: `0 ${px}px`,
  borderRadius: 999,
  border: "1px solid var(--line)",
  background: "var(--tile)",
  color: "var(--ink)",
  fontSize: size,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  boxShadow: "var(--btn-ghost-shadow)",
  textDecoration: "none",
  transition: "all .15s ease",
  cursor: "pointer",
});

export const logoMark = (
  size: number,
  radius: number,
  bar: number,
): ReactNode => (
  <span
    aria-hidden="true"
    style={{
      width: size,
      height: size,
      borderRadius: radius,
      background: "var(--ink)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <span
      style={{
        width: 2,
        height: bar,
        borderRadius: 2,
        background: "var(--accent)",
      }}
    />
  </span>
);

export function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="custom"
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        height: 28,
        padding: "0 12px",
        borderRadius: 99,
        border: "none",
        cursor: "pointer",
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--bg)" : "var(--ink2)",
        boxShadow: active ? "var(--segment-shadow)" : "none",
        transition: "all .15s ease",
      }}
    >
      {children}
    </Button>
  );
}
