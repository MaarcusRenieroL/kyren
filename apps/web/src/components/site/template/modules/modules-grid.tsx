/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";
import { hrefOf } from "../common";

export function ModulesGrid({ v }: { v: any }) {
  const { mgroups } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "96px var(--pr) 0 var(--px)",
      }}
    >
      <div>
        {mgroups.map((g: any, i15: number) => (
          <Fragment key={i15}>
            {g.show ? (
              <div data-rv={g.rvk} style={g.rv}>
                <div
                  style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: "var(--gCols)",
                    gap: "20px 32px",
                  }}
                >
                  <div style={g.br}></div>
                  <div
                    style={{
                      position: "absolute",
                      top: "34px",
                      left: "calc(var(--tx) - var(--px) - 4.5px)",
                    }}
                  >
                    <div data-nd={g.k} style={g.nd}></div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily:
                          "var(--font-geist-mono), ui-monospace, monospace",
                        fontSize: "11px",
                        letterSpacing: ".06em",
                        color: "var(--ink3)",
                      }}
                    >
                      {g.idx}
                    </span>
                    <span
                      style={{
                        fontFamily:
                          "var(--font-bricolage), var(--font-geist), sans-serif",
                        fontWeight: "700",
                        fontSize: "28px",
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {g.name}
                    </span>
                    <span
                      style={{
                        fontFamily:
                          "var(--font-geist-mono), ui-monospace, monospace",
                        fontSize: "12px",
                        color: "var(--ink3)",
                      }}
                    >
                      {g.meta}
                    </span>
                  </div>
                  <div style={{ borderTop: "1px solid var(--line)" }}>
                    {g.rows.map((r: any, i16: number) => (
                      <Fragment key={i16}>
                        <div style={r.rowSt}>
                          <span style={r.codeSt}>{r.code}</span>
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
                                fontSize: "17px",
                                fontWeight: "600",
                                letterSpacing: "-0.01em",
                              }}
                            >
                              {v.m && r.linkT ? (
                                <a
                                  href={hrefOf(r.go)}
                                  onClick={r.go}
                                  style={{ textDecoration: "underline" }}
                                >
                                  {r.n}
                                </a>
                              ) : (
                                r.n
                              )}
                            </span>
                            <span
                              style={{
                                flex: "1 1 260px",
                                fontSize: "15px",
                                lineHeight: "1.45",
                                color: "var(--ink2)",
                                textWrap: "pretty",
                              }}
                            >
                              {r.d}
                            </span>
                          </div>
                          <span style={r.chipSt}>{r.chipT}</span>
                          {!v.m && r.linkT ? (
                            <a
                              href={hrefOf(r.go)}
                              onClick={r.go}
                              style={r.linkSt}
                            >
                              {r.linkT}
                              <span style={r.ar}></span>
                            </a>
                          ) : null}
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
