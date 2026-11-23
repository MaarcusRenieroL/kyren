/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function ModuleTasksScreenTwo({ v }: { v: any }) {
  const { tdProps, tdLinks } = v;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "var(--ink3)",
        }}
      >
        <span>Zentro Web</span>
        <span>/</span>
        <span>Tasks</span>
        <span>/</span>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            color: "var(--ink)",
          }}
        >
          ZEN-18
        </span>
      </div>
      <div
        style={{
          fontSize: "22px",
          fontWeight: "600",
          letterSpacing: "-0.01em",
          lineHeight: "1.25",
        }}
      >
        Fix login redirect loop on expired sessions
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: "14px 16px",
          padding: "14px 0",
          borderTop: "1px solid var(--line2)",
          borderBottom: "1px solid var(--line2)",
        }}
      >
        {tdProps.map((x: any, i21: number) => (
          <Fragment key={i21}>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "10px",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "var(--ink3)",
                }}
              >
                {x.k}
              </div>
              <div style={x.st}>{x.v}</div>
            </div>
          </Fragment>
        ))}
      </div>
      <span
        style={{
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "11px",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--ink3)",
        }}
      >
        Linked
      </span>
      <div
        style={{
          position: "relative",
          paddingLeft: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "4px",
            top: "18px",
            bottom: "18px",
            width: "1.5px",
            background: "var(--accent)",
            boxShadow: "var(--glow)",
          }}
        ></div>
        {tdLinks.map((l: any, i22: number) => (
          <Fragment key={i22}>
            <div
              style={{
                position: "relative",
                padding: "8px 12px",
                borderRadius: "12px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "-24px",
                  top: "15px",
                  width: "9px",
                  height: "9px",
                  borderRadius: "99px",
                  background: "var(--accent)",
                }}
              ></span>
              <div
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "10px",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "var(--ink3)",
                }}
              >
                {l.k}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  marginTop: "2px",
                }}
              >
                {l.t}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "11px",
                  color: "var(--ink3)",
                  marginTop: "2px",
                }}
              >
                {l.s}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
