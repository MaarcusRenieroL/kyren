import { Button } from "@kyren/ui/shadcn/button";
import { useRef, useState } from "react";
import Link from "next/link";
import { paths } from "~/src/lib/paths";
import {
  DISPLAY,
  primaryPill,
  logoMark,
  Segment,
  type Mode,
} from "./landing-styles";

const links = [
  ["Modules", "/modules"],
  ["Pricing", "/pricing"],
  ["Roadmap", "/roadmap"],
  ["Security", "/security"],
  ["Changelog", "/changelog"],
] as const;

export function LandingHeader({
  m,
  mode,
  theme,
  chooseMode,
}: {
  m: boolean;
  mode: Mode;
  theme: "light" | "dark";
  chooseMode: (next: Mode) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 64,
        display: "flex",
        alignItems: "center",
        gap: m ? 8 : 24,
        padding: "0 var(--pr) 0 var(--navPL)",
        background: "var(--nav-bg)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--line2)",
        boxShadow: "0 1px 0 0 var(--line2)",
      }}
    >
      <a
        href="#top"
        aria-label="Kyren home"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--ink)",
          textDecoration: "none",
        }}
      >
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
      </a>
      {!m ? (
        <nav
          aria-label="Primary"
          style={{ display: "flex", gap: 28, marginLeft: 24 }}
        >
          {links.map(([name, href]) => {
            const style = {
              color: "var(--ink2)",
              fontSize: 14,
              textDecoration: "none",
            } as const;

            return href!.startsWith("/") ? (
              <Link key={href} href={href!} style={style}>
                {name}
              </Link>
            ) : (
              <a key={href} href={href} style={style}>
                {name}
              </a>
            );
          })}
        </nav>
      ) : null}
      <div className="l-rise" style={{ flex: 1 }} />
      {!m ? (
        <>
          <div
            role="group"
            aria-label="Theme"
            style={{
              display: "flex",
              gap: 2,
              padding: 3,
              border: "1px solid var(--line)",
              borderRadius: 999,
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
          </div>
          <Link
            href={paths.auth.signIn()}
            style={{
              color: "var(--ink)",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </>
      ) : null}
      <Link
        href={paths.auth.signUp()}
        className="l-btn"
        style={primaryPill(38, 18, 14)}
      >
        Get started
      </Link>
      {m ? (
        <Button
          variant="custom"
          type="button"
          ref={toggle}
          aria-label="Navigation menu"
          aria-expanded={open}
          aria-controls="mobile-primary"
          onClick={() => setOpen(!open)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "transparent",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            cursor: "pointer",
          }}
        >
          <span style={{ width: 14, height: 1.5, background: "var(--ink)" }} />
          <span style={{ width: 14, height: 1.5, background: "var(--ink)" }} />
        </Button>
      ) : null}
      {m && open && (
        <nav
          id="mobile-primary"
          aria-label="Primary"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
            padding: "8px var(--pr) 16px",
            display: "grid",
            maxHeight: "75dvh",
            overflowY: "auto",
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              toggle.current?.focus();
            }
          }}
        >
          {[...links, ["Sign in", paths.auth.signIn()] as const].map(
            ([name, href]) => (
              <Link
                key={href}
                href={href}
                style={{ padding: "10px 0", color: "var(--ink)" }}
                onClick={() => setOpen(false)}
              >
                {name}
              </Link>
            ),
          )}
          <Button
            variant="custom"
            type="button"
            onClick={() => chooseMode(theme === "dark" ? "light" : "dark")}
            style={{ textAlign: "left", padding: "10px 0" }}
          >
            Use {theme === "dark" ? "light" : "dark"} theme
          </Button>
        </nav>
      )}
    </header>
  );
}
