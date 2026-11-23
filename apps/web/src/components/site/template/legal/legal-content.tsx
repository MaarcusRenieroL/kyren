/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@zentro/ui/shadcn/button";
import { Fragment } from "react";
import { hrefOf } from "../common";

export function LegalContent({ v }: { v: any }) {
  const { rv, toc, toggleToc, tocLabel, tocChev, tocOpen, secs, go } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "64px var(--pr) 0 var(--px)",
      }}
    >
      <div data-rv="1" style={rv.r1}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--lgCols)",
            gap: "32px 96px",
            alignItems: "start",
          }}
        >
          <aside
            style={{
              display: "var(--tocD)",
              flexDirection: "column",
              position: "sticky",
              top: "96px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--ink3)",
                paddingBottom: "12px",
              }}
            >
              On this page
            </span>
            {toc.map((t: any, i43: number) => (
              <Fragment key={i43}>
                <a href={`#section-${t.n}`} onClick={t.go} style={t.st}>
                  <span
                    style={{
                      fontFamily:
                        "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "11px",
                      color: "var(--ink3)",
                    }}
                  >
                    {t.n}
                  </span>
                  {t.t}
                </a>
              </Fragment>
            ))}
          </aside>
          <article style={{ minWidth: "0", maxWidth: "720px" }}>
            <div
              style={{
                display: "var(--tocM)",
                borderTop: "1px solid var(--line)",
                borderBottom: "1px solid var(--line2)",
                marginBottom: "8px",
              }}
            >
              <Button
                variant="custom"
                onClick={toggleToc}
                style={{
                  width: "100%",
                  height: "52px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "none",
                  border: "none",
                  color: "var(--ink)",
                  fontSize: "15px",
                  fontWeight: "500",
                  cursor: "pointer",
                  padding: "0",
                }}
              >
                <span style={{ flex: "1", textAlign: "left" }}>{tocLabel}</span>
                <span style={tocChev}></span>
              </Button>
              {tocOpen ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    paddingBottom: "14px",
                  }}
                >
                  {toc.map((t: any, i44: number) => (
                    <Fragment key={i44}>
                      <a href={`#section-${t.n}`} onClick={t.go} style={t.st}>
                        <span
                          style={{
                            fontFamily:
                              "var(--font-geist-mono), ui-monospace, monospace",
                            fontSize: "11px",
                            color: "var(--ink3)",
                          }}
                        >
                          {t.n}
                        </span>
                        {t.t}
                      </a>
                    </Fragment>
                  ))}
                </div>
              ) : null}
            </div>
            {secs.map((x: any, i45: number) => (
              <Fragment key={i45}>
                <div
                  id={`section-${x.n}`}
                  style={{
                    scrollMarginTop: 72,
                    padding: "36px 0 8px",
                    borderTop: "1px solid var(--line2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "14px",
                      marginBottom: "16px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily:
                          "var(--font-geist-mono), ui-monospace, monospace",
                        fontSize: "12px",
                        color: "var(--ink3)",
                      }}
                    >
                      {x.n}
                    </span>
                    <h2
                      style={{
                        margin: "0",
                        fontFamily:
                          "var(--font-bricolage), var(--font-geist), sans-serif",
                        fontWeight: "700",
                        fontSize: "26px",
                        letterSpacing: "-0.03em",
                        lineHeight: "1.15",
                      }}
                    >
                      {x.t}
                    </h2>
                  </div>
                  {x.paras.map((pp: any, i46: number) => (
                    <Fragment key={i46}>
                      <p
                        style={{
                          margin: "0 0 18px",
                          fontSize: "17px",
                          lineHeight: "1.7",
                          color: "var(--ink)",
                          textWrap: "pretty",
                        }}
                      >
                        {pp}
                      </p>
                    </Fragment>
                  ))}
                </div>
              </Fragment>
            ))}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "20px",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "32px",
                padding: "28px 0 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span style={{ fontSize: "18px", fontWeight: "600" }}>
                  Questions about this policy?
                </span>
                <span style={{ fontSize: "15px", color: "var(--ink2)" }}>
                  Contact your workspace administrator for help with your
                  deployment.
                </span>
              </div>
              <a
                href={hrefOf(go.about)}
                onClick={go.about}
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
                About Zentro
              </a>
            </div>
          </article>
        </div>
      </div>
      <div style={{ height: "var(--sec)" }}></div>
    </section>
  );
}
