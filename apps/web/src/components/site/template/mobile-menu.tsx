/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@zentro/ui/shadcn/button";
import { Fragment } from "react";
import { hrefOf } from "./common";

export function SiteMobileMenu({ v }: { v: any }) {
  const { menuOn, menuLinks, th, thIc, setLight, setDark, setSys, footLegal } =
    v;

  if (!menuOn) return null;

  return (
    <nav
      id="site-mobile-menu"
      aria-label="Primary"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          v.toggleMenu();
          document.getElementById("site-menu-toggle")?.focus();
        }
      }}
      style={{
        position: "fixed",
        top: "64px",
        left: "0",
        right: "0",
        zIndex: "49",
        maxHeight: "calc(100dvh - 64px)",
        overflowY: "auto",
        background: "var(--bg)",
        padding: "8px 20px 32px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {menuLinks.map((l: any, i2: number) => (
        <Fragment key={i2}>
          <a href={hrefOf(l.go)} onClick={l.go} style={l.st}>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                color: "var(--ink3)",
                width: "28px",
              }}
            >
              {l.i}
            </span>
            <span style={{ flex: "1" }}>{l.t}</span>
            <span style={l.ar}></span>
          </a>
        </Fragment>
      ))}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 0",
          borderTop: "1px solid var(--line2)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          Theme
        </span>
        <div
          style={{
            display: "flex",
            gap: "2px",
            padding: "3px",
            border: "1px solid var(--line)",
            borderRadius: "999px",
          }}
        >
          <Button
            variant="custom"
            style={th.light}
            onClick={setLight}
            aria-label="Light theme"
            title="Light"
          >
            <span style={thIc.light}></span>
          </Button>
          <Button
            variant="custom"
            style={th.dark}
            onClick={setDark}
            aria-label="Dark theme"
            title="Dark"
          >
            <span style={thIc.dark}></span>
          </Button>
          <Button
            variant="custom"
            style={th.sys}
            onClick={setSys}
            aria-label="System theme"
            title="System"
          >
            <span style={thIc.sys}></span>
          </Button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "8px",
        }}
      >
        <a
          href={v.signedIn ? "/dashboard" : "/auth/sign-up"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "52px",
            borderRadius: "999px",
            background: "var(--btn)",
            color: "var(--btn-ink)",
            fontSize: "16px",
            fontWeight: "500",
            textDecoration: "none",
          }}
        >
          {v.signedIn ? "Open Zentro" : "Get started"}
        </a>
        <a
          href="/auth/sign-in"
          hidden={v.signedIn}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "52px",
            borderRadius: "999px",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            fontSize: "16px",
            fontWeight: "500",
            textDecoration: "none",
          }}
        >
          Sign in
        </a>
      </div>
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginTop: "28px",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "12px",
        }}
      >
        {footLegal.map((l: any, i3: number) => (
          <Fragment key={i3}>
            <a
              href={hrefOf(l.go)}
              onClick={l.go}
              style={{ color: "var(--ink3)" }}
            >
              {l.t}
            </a>
          </Fragment>
        ))}
      </div>
    </nav>
  );
}
