/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function StatusIncident({ v }: { v: any }) {
  const { inc, rv, incUpd } = v;

  if (!inc) return null;

  return (
    <section
      style={{
        position: "relative",
        padding: "72px var(--pr) 0 var(--px)",
      }}
    >
      <div data-rv="1" style={rv.r1}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            paddingBottom: "16px",
            flexWrap: "wrap",
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
            Current incident
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
            Example
          </span>
        </div>
        <div style={{ borderTop: "1px solid var(--line)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "16px",
              padding: "22px 0",
              borderBottom: "1px solid var(--line2)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "20px", fontWeight: "600" }}>
              Slow search results
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "12px",
                color: "var(--ink3)",
              }}
            >
              Search · started 10:42 UTC
            </span>
          </div>
          {incUpd.map((u: any, i48: number) => (
            <Fragment key={i48}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "var(--clCols)",
                  gap: "8px 40px",
                  padding: "20px 0",
                  borderBottom: "1px solid var(--line2)",
                  alignItems: "start",
                }}
              >
                <span
                  style={{
                    fontFamily:
                      "var(--font-geist-mono), ui-monospace, monospace",
                    fontSize: "13px",
                    color: "var(--ink2)",
                  }}
                >
                  {u.t} UTC
                </span>
                <span
                  style={{
                    fontSize: "15px",
                    lineHeight: "1.55",
                    maxWidth: "640px",
                  }}
                >
                  {u.x}
                </span>
                <span style={u.st}>{u.s}</span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
