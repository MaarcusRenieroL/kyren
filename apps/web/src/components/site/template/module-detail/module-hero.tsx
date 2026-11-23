/* eslint-disable @typescript-eslint/no-explicit-any */
import { hrefOf } from "../common";

export function ModuleHero({ v }: { v: any }) {
  const { nd, rv, go, md } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "var(--heroT) var(--pr) 0 var(--px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "0",
          bottom: "0",
          left: "60%",
          width: "200px",
          background: "linear-gradient(to bottom, transparent, var(--beam) 45%, transparent)",
          pointerEvents: "none",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          top: "-240px",
          left: "35%",
          width: "1000px",
          height: "800px",
          background: "radial-gradient(closest-side, var(--wash), transparent)",
          pointerEvents: "none",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 4.5px)",
          top: "calc(var(--heroT) + 4px)",
        }}
      >
        <div data-nd="k0" style={nd.k0}></div>
      </div>
      <div data-rv="0" style={rv.r0}>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "12px",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--ink3)",
            }}
          >
            <a href={hrefOf(go.modules)} onClick={go.modules} style={{ color: "var(--ink2)" }}>
              Modules
            </a>
            <span>/</span>
            <span>{md.group}</span>
            <span>/</span>
            <span style={{ color: "var(--ink)" }}>{md.n}</span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                letterSpacing: "0",
                textTransform: "none",
                color: "var(--green)",
                marginLeft: "6px",
              }}
            >
              ● Live
            </span>
          </div>
          <h1
            style={{
              margin: "0",
              maxWidth: "1040px",
              fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
              fontWeight: "700",
              fontSize: "var(--h1)",
              lineHeight: "0.98",
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            {md.h1a}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              {md.h1em}
            </em>
            {md.h1b}
          </h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "32px 64px",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <p
              style={{
                margin: "0",
                maxWidth: "580px",
                fontSize: "var(--lead)",
                lineHeight: "1.5",
                color: "var(--ink2)",
                textWrap: "pretty",
              }}
            >
              {md.lead}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <a
                href={v.signedIn ? "/dashboard" : "/auth/sign-up"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: "48px",
                  padding: "0 24px",
                  borderRadius: "999px",
                  background: "var(--btn)",
                  color: "var(--btn-ink)",
                  fontSize: "15px",
                  fontWeight: "500",
                  textDecoration: "none",
                }}
              >
                {v.signedIn ? "Open Zentro" : "Get started"}
              </a>
              <a
                href={hrefOf(go.modules)}
                onClick={go.modules}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: "48px",
                  padding: "0 22px",
                  borderRadius: "999px",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                  fontSize: "15px",
                  fontWeight: "500",
                  textDecoration: "none",
                }}
              >
                All modules
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
