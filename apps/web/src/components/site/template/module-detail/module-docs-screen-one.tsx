/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function ModuleDocsScreenOne({ v }: { v: any }) {
  const { ico, dh } = v;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
            fontWeight: "700",
            fontSize: "26px",
            letterSpacing: "-0.03em",
          }}
        >
          Docs
        </span>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            color: "var(--ink3)",
          }}
        >
          5 docs
        </span>
        <div style={{ flex: "1" }}></div>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            height: "30px",
            padding: "0 12px",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            fontSize: "12px",
            color: "var(--ink3)",
          }}
        >
          <span style={ico.search}></span>Search docs
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            height: "30px",
            padding: "0 12px",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            fontSize: "12px",
          }}
        >
          <span style={ico.plus}></span>New doc
        </span>
      </div>
      <div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--dhCols)",
            gap: "12px",
            padding: "8px 0",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          <span>Title</span>
          <span style={{ display: "var(--sbD)" }}>Project</span>
          <span style={{ display: "var(--sbD)" }}>Linked</span>
          <span>Updated</span>
        </div>
        {dh.map((d: any, i20: number) => (
          <Fragment key={i20}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "var(--dhCols)",
                gap: "12px",
                alignItems: "center",
                minHeight: "48px",
                borderTop: "1px solid var(--line2)",
                fontSize: "14px",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
                <span style={d.ic}>
                  <span style={ico.docs}></span>
                </span>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.t}
                </span>
              </span>
              <span style={{ display: "var(--sbD)", fontSize: "13px", color: "var(--ink2)" }}>
                {d.p}
              </span>
              <span
                style={{
                  display: "var(--sbD)",
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "12px",
                  color: "var(--ink2)",
                }}
              >
                {d.l}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "12px",
                  color: "var(--ink3)",
                }}
              >
                {d.u}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
