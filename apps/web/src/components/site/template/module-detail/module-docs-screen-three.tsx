/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function ModuleDocsScreenThree({ v }: { v: any }) {
  const { ico, share } = v;

  return (
    <>
      <div>
        <div style={{ fontSize: "18px", fontWeight: "600" }}>
          Share “Session handling spec”
        </div>
        <div
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            color: "var(--ink3)",
            marginTop: "4px",
          }}
        >
          Access follows Kyren Web unless you add people here
        </div>
      </div>
      <div
        style={{
          height: "40px",
          borderRadius: "12px",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "0 12px",
          fontSize: "13px",
          color: "var(--ink3)",
        }}
      >
        <span style={ico.search}></span>Add people or teams
      </div>
      <div>
        {share.map((r: any, i26: number) => (
          <Fragment key={i26}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                minHeight: "52px",
                borderTop: "1px solid var(--line2)",
              }}
            >
              <span style={r.av}>{r.i}</span>
              <div style={{ flex: "1", minWidth: "0" }}>
                <div style={{ fontSize: "14px", fontWeight: "500" }}>
                  {r.n}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    fontSize: "11px",
                    color: "var(--ink3)",
                  }}
                >
                  {r.s}
                </div>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--ink2)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "3px 9px",
                  whiteSpace: "nowrap",
                }}
              >
                {r.r}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
      <div
        style={{
          marginTop: "auto",
          padding: "14px",
          borderRadius: "14px",
          border: "1px dashed var(--line)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div style={{ flex: "1" }}>
          <div style={{ fontSize: "14px", fontWeight: "500" }}>
            Share outside Northwind Labs
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink3)", marginTop: "2px" }}>
            Only Owners and Admins can turn this on.
          </div>
        </div>
        <span
          style={{
            width: "36px",
            height: "20px",
            borderRadius: "99px",
            background: "var(--line)",
            position: "relative",
            opacity: ".6",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "2px",
              left: "2px",
              width: "16px",
              height: "16px",
              borderRadius: "99px",
              background: "var(--tile)",
            }}
          ></span>
        </span>
      </div>
    </>
  );
}
