/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function SecurityPermissions({ v }: { v: any }) {
  const { nd, rv, chainLine, chain } = v;

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
              02 · One permission system
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
              Access set once, carried{" "}
              <em
                style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  fontStyle: "italic",
                  fontWeight: "400",
                  fontSize: "1.1em",
                  letterSpacing: "-0.01em",
                }}
              >
                everywhere
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
              There is no separate permission setup per module. Each step below
              narrows or extends the one before it.
            </p>
          </div>
          <div style={{ position: "relative", paddingLeft: "36px" }}>
            <div style={chainLine}></div>
            {chain.map((c: any, i38: number) => (
              <Fragment key={i38}>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    gap: "20px",
                    padding: "20px 0 24px",
                    borderBottom: "1px solid var(--line2)",
                  }}
                >
                  <span style={c.ndSt}></span>
                  <span
                    style={{
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "12px",
                      color: "var(--ink3)",
                      width: "20px",
                      paddingTop: "4px",
                    }}
                  >
                    {c.i}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {c.t}
                    </span>
                    <span
                      style={{
                        fontSize: "15px",
                        lineHeight: "1.5",
                        color: "var(--ink2)",
                        textWrap: "pretty",
                      }}
                    >
                      {c.d}
                    </span>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
