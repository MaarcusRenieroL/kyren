import Link from "next/link";
import type { CSSProperties } from "react";
import { paths } from "~/src/lib/paths";
import {
  DISPLAY,
  MONO,
  accentWord,
  dashed,
  ghostPill,
  label,
  primaryPill,
} from "../landing-styles";

export function HeroHeading({
  fill,
  node,
  rise,
}: {
  fill: (key: "hero") => CSSProperties;
  node: (key: "hero") => CSSProperties;
  rise: (ms: number) => CSSProperties;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="l-drift"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "36%",
          width: 180,
          background:
            "linear-gradient(to bottom, transparent, var(--beam) 40%, transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        className="l-drift"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "61%",
          width: 120,
          background:
            "linear-gradient(to bottom, transparent, var(--beam) 55%, transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        className="l-drift"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "83%",
          width: 220,
          background:
            "linear-gradient(to bottom, var(--beam), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -240,
          left: "30%",
          width: 1100,
          height: 900,
          background: "radial-gradient(closest-side, var(--wash), transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 0.75px)",
          top: 150,
          bottom: 0,
          width: 1.5,
          ...dashed("v"),
        }}
      >
        <div style={fill("hero")} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 4.5px)",
          top: 146,
        }}
      >
        <div className="l-ping" style={node("hero")} />
      </div>

      <h1
        className="l-rise"
        style={{
          position: "relative",
          margin: 0,
          maxWidth: 1080,
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: "var(--h1)",
          lineHeight: 0.98,
          letterSpacing: "-0.04em",
          textWrap: "balance",
        }}
      >
        One workspace for <em style={accentWord}>everything</em> your company
        runs on.
      </h1>

      <div
        style={{
          flex: "1 1 300px",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          gap: 28,
          paddingTop: 6,
          ...rise(180),
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "var(--lead)",
            lineHeight: 1.5,
            color: "var(--ink2)",
            textWrap: "pretty",
          }}
        >
          Zentro puts your projects, tasks, docs and team under one permission
          system and one search, and you switch on only the modules you use.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link
            href={paths.auth.signUp()}
            className="l-btn"
            style={primaryPill(48, 24, 15)}
          >
            Get started
          </Link>
          <a href="#modules" className="l-btn" style={ghostPill(48, 22, 15)}>
            See the modules
          </a>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingTop: 20,
            borderTop: "1px solid var(--line2)",
          }}
        >
          <span style={label}>Live today</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--ink2)",
            }}
          >
            Projects · Tasks · Docs · Chat · Calendar · Tickets
          </span>
        </div>
      </div>
    </>
  );
}
