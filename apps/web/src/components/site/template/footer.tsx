/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Fragment } from "react";
import { hrefOf } from "./common";
import { FooterTheme } from "./footer-theme";

export function SiteFooter({ v }: { v: any }) {
  const {
    showFooter,
    go,
    footProduct,
    footLive,
    footCompany,
    footLegal,
    th,
    thIc,
    setLight,
    setDark,
    setSys,
  } = v;

  if (!showFooter) return null;

  return (
    <footer
      style={{
        position: "relative",
        borderTop: "1px solid var(--line2)",
        padding: "56px var(--pr) 48px var(--px)",
        display: "grid",
        gridTemplateColumns: "var(--ftCols)",
        gap: "44px 40px",
      }}
    >
      <div
        style={{
          gridColumn: "var(--ftSpan)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          minWidth: "0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
              fontSize: "20px",
              letterSpacing: "-0.04em",
            }}
          >
            Zentro
          </span>
        </div>
        <span style={{ fontSize: "14px", color: "var(--ink2)" }}>
          The operating system for startups.
        </span>
        <a
          href={hrefOf(go.status)}
          onClick={go.status}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "12px",
            color: "var(--ink2)",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "99px",
              background: "var(--ink3)",
            }}
          ></span>
          Service status
        </a>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            color: "var(--ink3)",
          }}
        >
          © 2026 Zentro
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          fontSize: "14px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          Product
        </span>
        <Link href="/" style={{ color: "var(--ink2)" }}>
          Overview
        </Link>
        {footProduct.map((l: any, i50: number) => (
          <Fragment key={i50}>
            <a href={hrefOf(l.go)} onClick={l.go} style={{ color: "var(--ink2)" }}>
              {l.t}
            </a>
          </Fragment>
        ))}
      </div>
      <div
        style={{
          gridColumn: "var(--ftSpan)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          minWidth: "0",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          Modules
        </span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 16px",
            fontSize: "14px",
          }}
        >
          {footLive.map((l: any, i51: number) => (
            <Fragment key={i51}>
              <a href={hrefOf(l.go)} onClick={l.go} style={{ color: "var(--ink)" }}>
                {l.t}
              </a>
            </Fragment>
          ))}
        </div>

      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          fontSize: "14px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          Company
        </span>
        {footCompany.map((l: any, i53: number) => (
          <Fragment key={i53}>
            <a href={hrefOf(l.go)} onClick={l.go} style={{ color: "var(--ink2)" }}>
              {l.t}
            </a>
          </Fragment>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          fontSize: "14px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          Legal
        </span>
        {footLegal.map((l: any, i54: number) => (
          <Fragment key={i54}>
            <a href={hrefOf(l.go)} onClick={l.go} style={{ color: "var(--ink2)" }}>
              {l.t}
            </a>
          </Fragment>
        ))}
      </div>
      <FooterTheme
        th={th}
        thIc={thIc}
        setLight={setLight}
        setDark={setDark}
        setSys={setSys}
      />
    </footer>
  );
}
