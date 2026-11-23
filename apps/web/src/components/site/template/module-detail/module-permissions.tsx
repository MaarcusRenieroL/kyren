/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function ModulePermissions({ v }: { v: any }) {
  const { nd, rv, md, roleNames, mdPerm } = v;

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
            03 · Permissions
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
            Who can do{" "}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              what
            </em>{" "}
            in {md.n}.
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
            {md.n} uses the workspace roles. These are the defaults,
            and Owners can change them in Roles & permissions.
          </p>
        </div>
        <div
          style={{
            marginTop: "48px",
            maxWidth: "980px",
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
              display: "grid",
              gridTemplateColumns: "var(--mxCols)",
              height: "52px",
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
            {roleNames.map((rl: any, i28: number) => (
              <Fragment key={i28}>
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
          {mdPerm.map((r: any, i29: number) => (
            <Fragment key={i29}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "var(--mxCols)",
                  minHeight: "48px",
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
                {r.cells.map((c: any, i30: number) => (
                  <Fragment key={i30}>
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
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 24px",
            marginTop: "20px",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "12px",
            color: "var(--ink2)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "99px",
                background: "var(--ink)",
              }}
            ></span>
            Allowed
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "10px",
                border: "1px solid var(--line)",
                borderRadius: "99px",
                padding: "1px 7px",
              }}
            >
              own
            </span>
            Only their own items
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "10px",
                border: "1px solid var(--line)",
                borderRadius: "99px",
                padding: "1px 7px",
              }}
            >
              shared
            </span>
            Only items shared with them
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "10px",
                height: "1.5px",
                background: "var(--ink3)",
              }}
            ></span>
            Not allowed
          </span>
        </div>
      </div>
    </section>
  );
}
