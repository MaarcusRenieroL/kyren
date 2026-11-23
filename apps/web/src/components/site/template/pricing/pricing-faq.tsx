/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@kyren/ui/shadcn/button";
import { Fragment } from "react";

export function PricingFaq({ v }: { v: any }) {
  const { nd, rv, faq } = v;

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
        <div data-nd="k4" style={nd.k4}></div>
      </div>
      <div data-rv="4" style={rv.r4}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--faqCols)",
            gap: "40px 64px",
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
              04 · FAQ
            </span>
            <h2
              style={{
                margin: "0",
                fontFamily:
                  "var(--font-bricolage), var(--font-geist), sans-serif",
                fontWeight: "700",
                fontSize: "var(--h2)",
                lineHeight: "1",
                letterSpacing: "-0.04em",
                textWrap: "balance",
              }}
            >
              Questions about{" "}
              <em
                style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  fontStyle: "italic",
                  fontWeight: "400",
                  fontSize: "1.1em",
                  letterSpacing: "-0.01em",
                }}
              >
                pricing
              </em>
              .
            </h2>
          </div>
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {faq.map((q: any, i13: number) => (
              <Fragment key={i13}>
                <div style={{ borderBottom: "1px solid var(--line2)" }}>
                  <Button
                    variant="custom"
                    onClick={q.click}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "22px 0",
                      background: "none",
                      border: "none",
                      color: "var(--ink)",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "18px",
                      fontWeight: "500",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    <span style={{ flex: "1" }}>{q.q}</span>
                    <span style={q.icSt}></span>
                  </Button>
                  {q.open ? (
                    <p
                      style={{
                        margin: "0 0 24px",
                        maxWidth: "620px",
                        fontSize: "16px",
                        lineHeight: "1.6",
                        color: "var(--ink2)",
                        textWrap: "pretty",
                      }}
                    >
                      {q.a}
                    </p>
                  ) : null}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
