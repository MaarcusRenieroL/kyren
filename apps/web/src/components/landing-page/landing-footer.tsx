import { FOOT_LIVE } from "./landing-data";
import {
  DISPLAY,
  MONO,
  label,
  logoMark,
  Segment,
  type Mode,
} from "./landing-styles";

export function LandingFooter({
  mode,
  chooseMode,
}: {
  mode: Mode;
  chooseMode: (next: Mode) => void;
}) {
  return (
    <footer
      style={{
        position: "relative",
        borderTop: "1px solid var(--line2)",
        padding: "56px var(--pr) 48px var(--px)",
        display: "flex",
        flexWrap: "wrap",
        gap: "48px 64px",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minWidth: 200,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {logoMark(22, 7, 12)}
          <span
            style={{
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "-0.04em",
            }}
          >
            Kyren
          </span>
        </div>
        <span style={{ fontSize: 14, color: "var(--ink2)" }}>
          The operating system for startups.
        </span>
        <span
          style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink3)" }}
        >
          © 2026 Kyren
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: "1 1 360px",
          maxWidth: 460,
        }}
      >
        <span style={label}>Modules</span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 16px",
            fontSize: 14,
          }}
        >
          {FOOT_LIVE.map((name) => (
            <a
              key={name}
              href="#modules"
              style={{ color: "var(--ink)", textDecoration: "none" }}
            >
              {name}
            </a>
          ))}
        </div>

      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          fontSize: 14,
        }}
      >
        <span style={label}>Company</span>
        {["Pricing", "Roadmap", "Changelog", "About", "Status"].map(
          (name) => (
            <a
              key={name}
              href={`/${name.toLowerCase()}`}
              style={{ color: "var(--ink2)", textDecoration: "none" }}
            >
              {name}
            </a>
          ),
        )}
        <span style={{ ...label, marginTop: 8 }}>Legal</span>
        {["Privacy", "Terms", "Security", "Cookies"].map((name) => (
          <a
            key={name}
            href={`/${name.toLowerCase()}`}
            style={{ color: "var(--ink2)", textDecoration: "none" }}
          >
            {name}
          </a>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={label}>Theme</span>
        <div
          role="group"
          aria-label="Theme"
          style={{
            display: "flex",
            gap: 2,
            padding: 3,
            border: "1px solid var(--line)",
            borderRadius: 999,
            alignSelf: "flex-start",
          }}
        >
          <Segment
            active={mode === "light"}
            onClick={() => chooseMode("light")}
          >
            Light
          </Segment>
          <Segment
            active={mode === "dark"}
            onClick={() => chooseMode("dark")}
          >
            Dark
          </Segment>
          <Segment
            active={mode === "system"}
            onClick={() => chooseMode("system")}
          >
            System
          </Segment>
        </div>
      </div>
    </footer>
  );
}
