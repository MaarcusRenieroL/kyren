/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function ModuleLinks({ v }: { v: any }) {
  const { nd, rv, md, lkLine, mdLinks } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "var(--sec) var(--pr) 0 var(--px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 4.5px)",
          top: "calc(var(--sec) + 4px)",
        }}
      >
        <div data-nd="k2" style={nd.k2}></div>
      </div>
      <div data-rv="2" style={rv.r2}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--lkCols)",
            gap: "40px 64px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "12px",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--ink3)",
              }}
            >
              02 · Links
            </span>
            <h2
              style={{
                margin: "0",
                fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
                fontWeight: "700",
                fontSize: "var(--h2)",
                lineHeight: "1",
                letterSpacing: "-0.04em",
                textWrap: "balance",
              }}
            >
              How {md.n} connects to other{" "}
              <em
                style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  fontStyle: "italic",
                  fontWeight: "400",
                  fontSize: "1.1em",
                  letterSpacing: "-0.01em",
                }}
              >
                modules
              </em>
              .
            </h2>
            <p
              style={{
                margin: "0",
                fontSize: "17px",
                lineHeight: "1.55",
                color: "var(--ink2)",
                textWrap: "pretty",
              }}
            >
              Live links work today. Dimmed links show where {md.n}{" "}
              will connect when those modules ship.
            </p>
          </div>
          <div style={{ position: "relative", paddingLeft: "36px" }}>
            <div style={lkLine}></div>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "0 0 22px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "-41px",
                  top: "9px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "99px",
                  background: "var(--accent)",
                  boxShadow:
                    "0 0 0 6px color-mix(in oklab, var(--accent) 20%, transparent), var(--glow)",
                }}
              ></span>
              <span style={md.codeSt}>{md.code}</span>
              <span
                style={{
                  fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
                  fontWeight: "700",
                  fontSize: "26px",
                  letterSpacing: "-0.03em",
                }}
              >
                {md.n}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "12px",
                  color: "var(--ink3)",
                }}
              >
                {md.lkMeta}
              </span>
            </div>
            <div style={{ borderTop: "1px solid var(--line)" }}>
              {mdLinks.map((l: any, i27: number) => (
                <Fragment key={i27}>
                  <div style={l.rowSt}>
                    <span style={l.ndSt}></span>
                    <span style={l.codeSt}>{l.code}</span>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px 24px",
                        alignItems: "baseline",
                        minWidth: "0",
                      }}
                    >
                      <span
                        style={{
                          width: "var(--mnW)",
                          fontSize: "16px",
                          fontWeight: "600",
                        }}
                      >
                        {l.n}
                      </span>
                      <span
                        style={{
                          flex: "1 1 240px",
                          fontSize: "15px",
                          lineHeight: "1.45",
                          color: "var(--ink2)",
                          textWrap: "pretty",
                        }}
                      >
                        {l.t}
                      </span>
                    </div>
                    <span style={l.chipSt}>{l.chipT}</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
