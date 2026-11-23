/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";
import { PricingAddonsCalculator } from "./pricing-addons-calculator";

export function PricingAddons({ v }: { v: any }) {
  const { nd, rv, addRows } = v;

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
        <div data-nd="k3" style={nd.k3}></div>
      </div>
      <div data-rv="3" style={rv.r3}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "760px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
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
              03 · Add-ons
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "var(--amber)",
                border: "1px dashed var(--amber)",
                borderRadius: "999px",
                padding: "2px 9px",
              }}
            >
              Concept
            </span>
          </div>
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
            Add coming modules one at a{" "}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              time
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
            The idea: every plan includes the live modules, and each
            coming module becomes an add-on you can switch on when
            it ships. Try it below. Prices are placeholders.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--adCols)",
            gap: "40px 64px",
            marginTop: "48px",
            alignItems: "start",
          }}
        >
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {addRows.map((a: any, i11: number) => (
              <Fragment key={i11}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "14px 0",
                    borderBottom: "1px solid var(--line2)",
                  }}
                >
                  <span style={a.codeSt}>{a.code}</span>
                  <div style={{ flex: "1", minWidth: "0" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: "600",
                        }}
                      >
                        {a.n}
                      </span>
                      <span
                        style={{
                          fontFamily:
                            "var(--font-geist-mono), ui-monospace, monospace",
                          fontSize: "10px",
                          color: "var(--ink2)",
                          border: "1px dashed var(--ink3)",
                          borderRadius: "999px",
                          padding: "1px 8px",
                        }}
                      >
                        Coming
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        lineHeight: "1.4",
                        color: "var(--ink2)",
                        marginTop: "3px",
                      }}
                    >
                      {a.d}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily:
                        "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "12px",
                      color: "var(--ink3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + $00
                  </span>
                  <div style={a.track} onClick={a.click}>
                    <span style={a.knob}></span>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
          <PricingAddonsCalculator v={v} />
        </div>
      </div>
    </section>
  );
}
