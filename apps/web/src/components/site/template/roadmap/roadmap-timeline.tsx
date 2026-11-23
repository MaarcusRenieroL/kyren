/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";
import { RoadmapRow } from "./roadmap-row";

export function RoadmapTimeline({ v }: { v: any }) {
  const { rmGroups, ico } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "120px var(--pr) 0 var(--px)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "96px",
        }}
      >
        {rmGroups.map((g: any, i31: number) => (
          <Fragment key={i31}>
            <div data-rv={g.rvk} style={g.rv}>
              <div style={{ position: "relative" }}>
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
                    alignItems: "baseline",
                    gap: "16px",
                    paddingBottom: "24px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "11px",
                      letterSpacing: ".06em",
                      color: "var(--ink3)",
                    }}
                  >
                    {g.idx}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
                      fontWeight: "700",
                      fontSize: "40px",
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {g.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "12px",
                      color: "var(--ink3)",
                    }}
                  >
                    {g.meta}
                  </span>
                </div>
                {g.rows.map((r: any, i32: number) => (
                  <Fragment key={i32}>
                    <RoadmapRow r={r} ico={ico} />
                  </Fragment>
                ))}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
