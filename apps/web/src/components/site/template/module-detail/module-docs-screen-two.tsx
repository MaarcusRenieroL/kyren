/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function ModuleDocsScreenTwo({ v }: { v: any }) {
  const { tools, ico, docTasks } = v;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          paddingBottom: "12px",
          borderBottom: "1px solid var(--line2)",
        }}
      >
        {tools.map((t: any, i23: number) => (
          <Fragment key={i23}>
            <span
              style={{
                width: "30px",
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                color: "var(--ink2)",
              }}
            >
              <span style={t}></span>
            </span>
          </Fragment>
        ))}
        <div style={{ flex: "1" }}></div>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            color: "var(--ink3)",
          }}
        >
          Saved
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
          fontWeight: "700",
          fontSize: "28px",
          letterSpacing: "-0.03em",
          lineHeight: "1.05",
        }}
      >
        Session handling spec
      </div>
      <div
        style={{
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "11px",
          color: "var(--ink3)",
        }}
      >
        Zentro Web · edited 1h ago by Priya Raman
      </div>
      <p
        style={{
          margin: "0",
          fontSize: "14px",
          lineHeight: "1.6",
          color: "var(--ink2)",
        }}
      >
        When a session expires, the app sends the user to sign in once and
        returns them to the page they were on. Refresh tokens rotate on every use.
      </p>
      <div style={{ fontSize: "16px", fontWeight: "600" }}>Token rotation</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "5px",
              background: "var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={ico.checkInv}></span>
          </span>
          <span style={{ color: "var(--ink2)", textDecoration: "line-through" }}>
            Rotate refresh token on use
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "5px",
              border: "1.5px solid var(--ink3)",
            }}
          ></span>
          Stop the redirect loop when both tokens expire
        </span>
      </div>
      <div
        style={{
          marginTop: "auto",
          paddingTop: "14px",
          borderTop: "1px solid var(--line2)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          Linked tasks
        </span>
        {docTasks.map((r: any, i24: number) => (
          <Fragment key={i24}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
              <span style={r.g}></span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "12px",
                  color: "var(--ink3)",
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
            </div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
