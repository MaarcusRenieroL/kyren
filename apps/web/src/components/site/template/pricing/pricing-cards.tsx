/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@zentro/ui/shadcn/button";
import { Fragment } from "react";

export function PricingCards({ v }: { v: any }) {
  const { nd, rv, billNote, bill, plans, incl, ico } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "96px var(--pr) 0 var(--px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 4.5px)",
          top: "100px",
        }}
      >
        <div data-nd="k1" style={nd.k1}></div>
      </div>
      <div data-rv="1" style={rv.r1}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "20px",
            borderBottom: "1px solid var(--line)",
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
            01 · Plans
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                color: "var(--ink3)",
              }}
            >
              {billNote}
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
              {bill.map((b: any, i4: number) => (
                <Fragment key={i4}>
                  <Button variant="custom" style={b.st} onClick={b.go}>
                    {b.l}
                  </Button>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--plCols)",
          }}
        >
          {plans.map((pl: any, i5: number) => (
            <Fragment key={i5}>
              <div style={pl.colSt}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily:
                        "var(--font-bricolage), var(--font-geist), sans-serif",
                      fontWeight: "700",
                      fontSize: "28px",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {pl.n}
                  </span>
                  <span
                    style={{
                      fontFamily:
                        "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "10px",
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: "var(--amber)",
                      border: "1px dashed var(--amber)",
                      borderRadius: "999px",
                      padding: "1px 8px",
                    }}
                  >
                    Placeholder
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "15px",
                    lineHeight: "1.45",
                    color: "var(--ink2)",
                    minHeight: "44px",
                    textWrap: "pretty",
                  }}
                >
                  {pl.d}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "22px",
                      color: "var(--ink3)",
                      paddingTop: "10px",
                    }}
                  >
                    $
                  </span>
                  <span
                    style={{
                      fontFamily:
                        "var(--font-bricolage), var(--font-geist), sans-serif",
                      fontWeight: "700",
                      fontSize: "72px",
                      lineHeight: "1",
                      letterSpacing: "-0.04em",
                      color: "var(--ink3)",
                      backgroundImage:
                        "repeating-linear-gradient(135deg, var(--line2) 0 6px, transparent 6px 12px)",
                      border: "1px dashed var(--line)",
                      borderRadius: "10px",
                      padding: "2px 10px",
                    }}
                  >
                    00
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      color: "var(--ink2)",
                    }}
                  >
                    {pl.per}
                  </span>
                  <span
                    style={{
                      fontFamily:
                        "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "11px",
                      color: "var(--ink3)",
                    }}
                  >
                    {pl.note}
                  </span>
                </div>
                <a
                  href="#"
                  style={{
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    alignItems: "center",
                    height: "44px",
                    padding: "0 20px",
                    borderRadius: "999px",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                    fontSize: "14px",
                    fontWeight: "500",
                    textDecoration: "none",
                  }}
                >
                  Choose {pl.n}
                </a>
              </div>
            </Fragment>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 28px",
            alignItems: "center",
            padding: "20px 0",
            borderTop: "1px solid var(--line2)",
            borderBottom: "1px solid var(--line2)",
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
            On every plan
          </span>
          {incl.map((x: any, i6: number) => (
            <Fragment key={i6}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                }}
              >
                <span style={ico.check}></span>
                {x}
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
