/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function StatusComponents({ v }: { v: any }) {
  const { rv, comps } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "72px var(--pr) 0 var(--px)",
      }}
    >
      <div data-rv="2" style={rv.r2}>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "12px",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          Components
        </span>
        <div
          style={{
            marginTop: "16px",
            borderTop: "1px solid var(--line)",
          }}
        >
          {comps.map((c: any, i49: number) => (
            <Fragment key={i49}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  minHeight: "56px",
                  borderBottom: "1px solid var(--line2)",
                }}
              >
                <span style={{ flex: "1", fontSize: "15px" }}>{c.n}</span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={c.dot}></span>
                  <span style={c.tSt}>{c.s}</span>
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
