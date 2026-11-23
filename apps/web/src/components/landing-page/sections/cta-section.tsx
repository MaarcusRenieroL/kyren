import Link from "next/link";
import type { CSSProperties } from "react";
import { paths } from "~/src/lib/paths";
import type { ThreadKey } from "../landing-data";
import {
  DISPLAY,
  accentWord,
  dashed,
  ghostPill,
  primaryPill,
} from "../landing-styles";

export function CtaSection({
  fill,
  endOn,
  trans,
}: {
  fill: (key: ThreadKey) => CSSProperties;
  endOn: boolean;
  trans?: string;
}) {
  return (
    <section
      style={{
        position: "relative",
        padding: "0 var(--pr) 0 var(--ctaPL)",
        textAlign: "var(--ctaAlign)" as CSSProperties["textAlign"],
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "30%",
          width: 140,
          background:
            "linear-gradient(to bottom, transparent, var(--beam) 60%, transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: 240,
          marginLeft: -120,
          background:
            "linear-gradient(to bottom, var(--beam), transparent 90%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "68%",
          width: 120,
          background:
            "linear-gradient(to bottom, transparent, var(--beam) 50%, transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "var(--ctaX)",
          top: 160,
          width: 1200,
          height: 760,
          marginLeft: -600,
          background:
            "radial-gradient(closest-side, var(--halo), transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 120,
          height: 700,
          background:
            "radial-gradient(closest-side, var(--wash), transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 0.75px)",
          top: 0,
          height: 120,
          width: 1.5,
          ...dashed("v"),
        }}
      >
        <div style={fill("s6a")} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "var(--tx)",
          top: 120,
          width: "calc(var(--ctaX) - var(--tx))",
          height: 1.5,
          ...dashed("h"),
        }}
      >
        <div style={fill("s6b")} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--ctaX) - 0.75px)",
          top: 120,
          height: 110,
          width: 1.5,
          ...dashed("v"),
        }}
      >
        <div style={fill("s6c")} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--ctaX) - 7px)",
          top: 226,
        }}
      >
        <div
          className={endOn ? "l-ping" : undefined}
          style={{
            width: 14,
            height: 14,
            borderRadius: 99,
            background: endOn ? "var(--accent)" : "var(--bg)",
            border: endOn ? "none" : "1.5px solid var(--track)",
            boxSizing: "border-box",
            boxShadow: endOn
              ? "0 0 0 6px color-mix(in oklab, var(--accent) 22%, transparent), 0 0 24px var(--accent)"
              : "none",
            transition: trans ?? "all .3s",
          }}
        />
      </div>
      <div
        style={{
          position: "relative",
          paddingTop: 290,
          maxWidth: 1100,
          margin: "var(--ctaM)",
          display: "flex",
          flexDirection: "column",
          gap: 28,
          alignItems: "var(--ctaJ)" as CSSProperties["alignItems"],
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: "var(--h3)",
            lineHeight: 0.95,
            letterSpacing: "-0.045em",
            textWrap: "balance",
          }}
        >
          Build your team’s <em style={accentWord}>workspace</em>.
        </h2>
        <p
          style={{
            margin: 0,
            maxWidth: 520,
            fontSize: "var(--lead)",
            lineHeight: 1.5,
            color: "var(--ink2)",
          }}
        >
          Create an organization, invite your team and choose the modules you need.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "var(--ctaJ)" as CSSProperties["justifyContent"],
          }}
        >
          <Link
            href={paths.auth.signUp()}
            className="l-btn"
            style={primaryPill(56, 30, 16)}
          >
            Get started
          </Link>
          <a
            href="#modules"
            className="l-btn"
            style={ghostPill(56, 26, 16)}
          >
            See the modules
          </a>
        </div>
      </div>
      <div style={{ height: "var(--sec)" }} />
    </section>
  );
}
