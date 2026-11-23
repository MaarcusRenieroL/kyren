/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";

export function PricingAddonsCalculator({ v }: { v: any }) {
  const { addSel, addNone, addCount } = v;

  return (
    <div
      style={{
        position: "sticky",
        top: "96px",
        backgroundColor: "var(--tile)",
        backgroundImage: "var(--glass)",
        border: "1px solid var(--line)",
        borderRadius: "20px",
        boxShadow: "var(--shadow)",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "11px",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--ink3)",
        }}
      >
        Example total
      </span>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "15px", fontWeight: "600" }}>
          [Plan B]
        </span>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "13px",
            color: "var(--ink3)",
          }}
        >
          $00
        </span>
      </div>
      {addSel.map((x: any, i12: number) => (
        <Fragment key={i12}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "14px", color: "var(--ink2)" }}>
              + {x}
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "13px",
                color: "var(--ink3)",
              }}
            >
              $00
            </span>
          </div>
        </Fragment>
      ))}
      {addNone ? (
        <span style={{ fontSize: "14px", color: "var(--ink3)" }}>
          No add-ons switched on.
        </span>
      ) : null}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "12px",
          paddingTop: "14px",
          borderTop: "1px solid var(--line2)",
        }}
      >
        <span style={{ fontSize: "15px", fontWeight: "600" }}>
          Per person / month
        </span>
        <span
          style={{
            fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
            fontWeight: "700",
            fontSize: "30px",
            letterSpacing: "-0.03em",
            color: "var(--ink3)",
          }}
        >
          $00
        </span>
      </div>
      <span
        style={{
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "11px",
          color: "var(--amber)",
        }}
      >
        {addCount} · placeholder, not a price
      </span>
    </div>
  );
}
