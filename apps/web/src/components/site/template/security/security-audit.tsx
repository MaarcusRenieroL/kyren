/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function SecurityAudit({ v }: { v: any }) {
  const { nd, rv, notM, audit } = v;

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
            03 · Audit log
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
            Every change, who made it and{" "}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              when
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
            Role changes, module switches, shares and edits in every module go to
            one log. Owners and Admins can read it. The entries below are an
            example.
          </p>
        </div>
        <div
          style={{
            marginTop: "48px",
            borderTop: "1px solid var(--line)",
          }}
        >
          {notM ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "var(--auCols)",
                gap: "16px",
                padding: "12px 0",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "var(--ink3)",
                borderBottom: "1px solid var(--line2)",
              }}
            >
              <span>When</span>
              <span>Who</span>
              <span>What</span>
              <span>Module</span>
            </div>
          ) : null}
          {audit.map((a: any, i39: number) => (
            <Fragment key={i39}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "var(--auCols)",
                  gap: "6px 16px",
                  padding: "16px 0",
                  borderBottom: "1px solid var(--line2)",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    fontSize: "12px",
                    color: "var(--ink3)",
                  }}
                >
                  {a.t}
                </span>
                <span style={{ fontSize: "14px", fontWeight: "500" }}>
                  {a.w}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    lineHeight: "1.45",
                    color: "var(--ink2)",
                  }}
                >
                  {a.a}
                </span>
                <span style={a.tag}>{a.mod}</span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
