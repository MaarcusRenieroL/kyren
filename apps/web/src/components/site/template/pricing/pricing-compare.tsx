/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@zentro/ui/shadcn/button";
import { Fragment, type CSSProperties } from "react";

export function PricingCompare({ v }: { v: any }) {
  const { nd, rv, m, planTabs, cmpHead, cmpRows } = v;

  return (
    <section
      id="compare"
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
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "720px",
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
            02 · Compare
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
            What changes between{" "}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              plans
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
            Rows marked TBD are not decided. The live modules, search, roles and
            the audit log are the same on every plan.
          </p>
        </div>
        {m ? (
          <div
            style={{
              display: "flex",
              gap: "2px",
              padding: "3px",
              border: "1px solid var(--line)",
              borderRadius: "999px",
              alignSelf: "flex-start",
              width: "max-content",
              marginTop: "28px",
            }}
          >
            {planTabs.map((b: any, i7: number) => (
              <Fragment key={i7}>
                <Button variant="custom" style={b.st} onClick={b.go}>
                  {b.l}
                </Button>
              </Fragment>
            ))}
          </div>
        ) : null}
        <div style={{ marginTop: "40px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "var(--cmpCols)",
              alignItems: "end",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--line)",
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
              Feature
            </span>
            {cmpHead.map((h: any, i8: number) => (
              <Fragment key={i8}>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: "600",
                    textAlign: "var(--cmpTA)" as CSSProperties["textAlign"],
                  }}
                >
                  {h}
                </span>
              </Fragment>
            ))}
          </div>
          {cmpRows.map((r: any, i9: number) => (
            <Fragment key={i9}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "var(--cmpCols)",
                  alignItems: "center",
                  minHeight: "56px",
                  borderBottom: "1px solid var(--line2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                    padding: "12px 16px 12px 0",
                  }}
                >
                  <span style={{ fontSize: "15px" }}>{r.l}</span>
                  {r.hasSub ? (
                    <span
                      style={{
                        fontFamily:
                          "var(--font-geist-mono), ui-monospace, monospace",
                        fontSize: "11px",
                        color: "var(--ink3)",
                      }}
                    >
                      {r.sub}
                    </span>
                  ) : null}
                </div>
                {r.cells.map((c: any, i10: number) => (
                  <Fragment key={i10}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "var(--cmpJ)",
                      }}
                    >
                      <span style={c.st}>{c.t}</span>
                    </div>
                  </Fragment>
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
