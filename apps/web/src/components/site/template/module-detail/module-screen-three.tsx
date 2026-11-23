/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleTasksScreenThree } from "./module-tasks-screen-three";
import { ModuleDocsScreenThree } from "./module-docs-screen-three";

export function ModuleScreenThree({ v }: { v: any }) {
  const { md, isTasks, isDocs } = v;

  return (
    <figure style={{ margin: "0" }}>
      <div
        style={{
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
            {md.url3}
          </span>
        </div>
        <div
          style={{
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            minHeight: "520px",
          }}
        >
          {isTasks ? <ModuleTasksScreenThree v={v} /> : null}
          {isDocs ? <ModuleDocsScreenThree v={v} /> : null}
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
          FIG 3
        </span>
        <span style={{ fontSize: "15px", fontWeight: "600" }}>{md.s3t}</span>
        <span style={{ fontSize: "14px", color: "var(--ink2)" }}>{md.s3d}</span>
      </figcaption>
    </figure>
  );
}
