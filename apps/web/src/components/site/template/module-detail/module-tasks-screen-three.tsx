/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function ModuleTasksScreenThree({ v }: { v: any }) {
  const { upNext } = v;

  return (
    <>
      <div>
        <div
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".06em",
            color: "var(--ink3)",
          }}
        >
          WED 14 OCT · 2 OVERDUE · 1 DUE TODAY
        </div>
        <div
          style={{
            fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
            fontWeight: "700",
            fontSize: "26px",
            letterSpacing: "-0.03em",
            marginTop: "6px",
          }}
        >
          Good morning, Priya
        </div>
      </div>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--tile)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
            FOCUS · ZEN-18
          </span>
          <span
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "11px",
              padding: "3px 9px",
              borderRadius: "999px",
              color: "var(--amber)",
              background: "color-mix(in oklab, var(--amber) 15%, transparent)",
            }}
          >
            In progress
          </span>
        </div>
        <div
          style={{
            fontSize: "18px",
            fontWeight: "600",
            lineHeight: "1.3",
          }}
        >
          Fix login redirect loop on expired sessions
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "40px",
                letterSpacing: "-0.03em",
                lineHeight: "1",
              }}
            >
              01:12:40
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "8px",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                color: "var(--amber)",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "99px",
                  background: "var(--amber)",
                }}
              ></span>
              Running since 09:02
            </div>
          </div>
          <span
            style={{
              height: "34px",
              padding: "0 14px",
              borderRadius: "999px",
              border: "1px solid var(--line)",
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Pause
          </span>
        </div>
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".06em",
            color: "var(--ink3)",
            paddingBottom: "8px",
          }}
        >
          UP NEXT
        </div>
        {upNext.map((r: any, i25: number) => (
          <Fragment key={i25}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                height: "44px",
                borderTop: "1px solid var(--line2)",
                fontSize: "13px",
              }}
            >
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
              <span style={r.st}>{r.s}</span>
            </div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
