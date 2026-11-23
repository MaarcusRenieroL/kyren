/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function ModuleTasksScreenOne({ v }: { v: any }) {
  const { ico, tl } = v;

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
          Tasks
        </span>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            color: "var(--ink3)",
          }}
        >
          12 open
        </span>
        <div style={{ flex: "1" }}></div>
        <div
          style={{
            display: "flex",
            gap: "2px",
            padding: "2px",
            border: "1px solid var(--line)",
            borderRadius: "10px",
            fontSize: "12px",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "26px",
              padding: "0 10px",
              borderRadius: "8px",
              background: "var(--tile2)",
            }}
          >
            <span style={ico.list}></span>List
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "26px",
              padding: "0 10px",
              color: "var(--ink2)",
            }}
          >
            <span style={ico.board}></span>Board
          </span>
        </div>
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
          <span style={ico.plus}></span>New task
        </span>
      </div>
      {tl.map((g: any, i18: number) => (
        <Fragment key={i18}>
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 0",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "var(--ink3)",
              }}
            >
              <span style={g.g}></span>
              {g.label}
              <span>{g.count}</span>
            </div>
            {g.rows.map((r: any, i19: number) => (
              <Fragment key={i19}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    height: "44px",
                    borderTop: "1px solid var(--line2)",
                    fontSize: "14px",
                  }}
                >
                  <span style={r.g}></span>
                  <span
                    style={{
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "12px",
                      color: "var(--ink3)",
                      width: "52px",
                      flex: "none",
                    }}
                  >
                    {r.k}
                  </span>
                  <span
                    style={{
                      flex: "1",
                      minWidth: "0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.t}
                  </span>
                  <span
                    style={{
                      display: "var(--sbD)",
                      fontSize: "12px",
                      color: "var(--ink2)",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "1px 7px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.proj}
                  </span>
                  <span style={r.av}>{r.a}</span>
                  <span style={r.dueSt}>{r.due}</span>
                </div>
              </Fragment>
            ))}
          </div>
        </Fragment>
      ))}
    </>
  );
}
