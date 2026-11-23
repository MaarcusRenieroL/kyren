/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@kyren/ui/shadcn/button";
import Link from "next/link";
import { Fragment } from "react";
import { hrefOf } from "./common";

export function SiteHeader({ v }: { v: any }) {
  const {
    showNav,
    navLinks,
    th,
    thIc,
    setLight,
    setDark,
    setSys,
    m,
    toggleMenu,
    menuIc,
  } = v;

  if (!showNav) return null;

  return (
    <header
      style={{
        position: "sticky",
        top: "0",
        zIndex: "50",
        height: "64px",
        display: "flex",
        alignItems: "center",
        gap: m ? "10px" : "24px",
        padding: "0 var(--pr) 0 var(--navPL)",
        background: "var(--nav-bg)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--line2)",
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "var(--ink)",
          textDecoration: "none",
        }}
      >
        <span
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "7px",
            background: "var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              width: "2px",
              height: "12px",
              borderRadius: "2px",
              background: "var(--accent)",
            }}
          ></span>
        </span>
        <span
          style={{
            fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
            fontWeight: "700",
            fontSize: "17px",
            letterSpacing: "-0.03em",
          }}
        >
          kyren
        </span>
      </Link>
      {!m && (
        <>
          <nav
            aria-label="Primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              marginRight: "auto",
            }}
          >
            {navLinks.map((l: any, i: number) => (
              <Fragment key={i}>
                <a href={hrefOf(l.go)} onClick={l.go} style={l.st}>
                  {l.t}
                </a>
              </Fragment>
            ))}
          </nav>
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
          {!v.signedIn ? (
            <>
              <a
                href="/auth/sign-in"
                style={{
                  color: "var(--ink2)",
                  fontSize: "14px",
                  fontWeight: "500",
                  textDecoration: "none",
                }}
              >
                Sign in
              </a>
            </>
          ) : null}
        </>
      )}
      <a
        href={v.signedIn ? "/dashboard" : "/auth/sign-up"}
        style={{
          marginLeft: m ? "auto" : undefined,
          display: "inline-flex",
          alignItems: "center",
          height: "38px",
          padding: "0 18px",
          borderRadius: "999px",
          border: "1px solid var(--line)",
          color: "var(--ink)",
          fontSize: "14px",
          fontWeight: "500",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {v.signedIn ? "Open Kyren" : "Get started"}
      </a>
      {m ? (
        <>
          <Button
            variant="custom"
            onClick={toggleMenu}
            aria-label="Menu"
            id="site-menu-toggle"
            aria-expanded={v.menuOn}
            aria-controls="site-mobile-menu"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "12px",
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <span style={menuIc}></span>
          </Button>
        </>
      ) : null}
    </header>
  );
}
