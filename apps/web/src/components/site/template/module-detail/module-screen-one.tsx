/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";
import { ModuleTasksScreenOne } from "./module-tasks-screen-one";
import { ModuleDocsScreenOne } from "./module-docs-screen-one";

export function ModuleScreenOne({ v }: { v: any }) {
  const { md, sbNav, isTasks, isDocs } = v;

  return (
    <figure style={{ margin: "0" }}>
      <div
        style={{
          position: "relative",
          borderRadius: "20px",
          border: "1px solid var(--line)",
          background: "var(--frame)",
          boxShadow: "var(--shadow)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "40px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "0 16px",
            borderBottom: "1px solid var(--line2)",
          }}
        >
          <span style={{ width: "9px", height: "9px", borderRadius: "99px", background: "var(--line)" }}></span>
          <span style={{ width: "9px", height: "9px", borderRadius: "99px", background: "var(--line)" }}></span>
          <span style={{ width: "9px", height: "9px", borderRadius: "99px", background: "var(--line)" }}></span>
          <span
            style={{
              flex: "1",
              textAlign: "center",
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "12px",
              color: "var(--ink3)",
            }}
          >
            {md.url1}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--shotCols)",
            minHeight: "var(--shotH)",
          }}
        >
          <div
            style={{
              display: "var(--sbD)",
              borderRight: "1px solid var(--line2)",
              padding: "16px 12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "0 8px 16px",
              }}
            >
              <span
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "7px",
                  background: "var(--peach)",
                  border: "1px solid var(--line)",
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                N
              </span>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>
                Northwind Labs
              </span>
            </div>
            {sbNav.map((i: any, i17: number) => (
              <Fragment key={i17}>
                <div style={i.st}>
                  <span style={i.ic}></span>
                  <span style={{ flex: "1" }}>{i.l}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "11px",
                      color: "var(--ink3)",
                    }}
                  >
                    {i.b}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
          <div
            style={{
              padding: "22px var(--shotP)",
              minWidth: "0",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {isTasks ? <ModuleTasksScreenOne v={v} /> : null}
            {isDocs ? <ModuleDocsScreenOne v={v} /> : null}
          </div>
        </div>
      </div>
      <figcaption
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 16px",
          alignItems: "baseline",
          marginTop: "16px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            color: "var(--accent)",
          }}
        >
          FIG 1
        </span>
        <span style={{ fontSize: "15px", fontWeight: "600" }}>{md.s1t}</span>
        <span style={{ fontSize: "14px", color: "var(--ink2)" }}>{md.s1d}</span>
      </figcaption>
    </figure>
  );
}
