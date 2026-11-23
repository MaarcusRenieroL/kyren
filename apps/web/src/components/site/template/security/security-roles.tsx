/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function SecurityRoles({ v }: { v: any }) {
  const { nd, rv, secRoles, roleNames, secMatrix } = v;

  return (
    <section
      id="roles"
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
        <div data-nd="k1" style={nd.k1}></div>
      </div>
      <div data-rv="1" style={rv.r1}>
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
            01 · Roles
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
            Four roles, the same in every{" "}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              module
            </em>
            .
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--rlCols)",
            marginTop: "48px",
            borderTop: "1px solid var(--line)",
          }}
        >
          {secRoles.map((r: any, i34: number) => (
            <Fragment key={i34}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "24px 24px 28px 0",
                  borderBottom: "1px solid var(--line2)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    fontSize: "11px",
                    color: "var(--ink3)",
                  }}
                >
                  {r.idx}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
                    fontWeight: "700",
                    fontSize: "28px",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {r.n}
                </span>
                <span
                  style={{
                    fontSize: "15px",
                    lineHeight: "1.5",
                    color: "var(--ink2)",
                    textWrap: "pretty",
                  }}
                >
                  {r.d}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
        <div
          style={{
            marginTop: "40px",
            backgroundColor: "var(--tile)",
            backgroundImage: "var(--glass)",
            border: "1px solid var(--line)",
            borderRadius: "20px",
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "16px 20px",
              borderBottom: "1px solid var(--line2)",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: "600" }}>
              Default permissions
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                color: "var(--ink3)",
              }}
            >
              Owners can change these
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "var(--mxCols)",
              height: "48px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                padding: "0 20px",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "var(--ink3)",
              }}
            >
              Permission
            </div>
            {roleNames.map((rl: any, i35: number) => (
              <Fragment key={i35}>
                <div
                  style={{
                    textAlign: "center",
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    fontSize: "11px",
                    color: "var(--ink2)",
                  }}
                >
                  {rl}
                </div>
              </Fragment>
            ))}
          </div>
          {secMatrix.map((r: any, i36: number) => (
            <Fragment key={i36}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "var(--mxCols)",
                  minHeight: "46px",
                  borderTop: "1px solid var(--line2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 20px",
                    fontSize: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: "500" }}>{r.mod}</span>
                  <span style={{ color: "var(--ink2)" }}>{r.act}</span>
                </div>
                {r.cells.map((c: any, i37: number) => (
                  <Fragment key={i37}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={c.g}>{c.t}</span>
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
