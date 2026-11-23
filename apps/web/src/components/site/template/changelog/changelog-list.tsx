/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@zentro/ui/shadcn/button";
import { Fragment } from "react";

export function ChangelogList({ v }: { v: any }) {
  const { rv, clChips, entries, clEmpty } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "96px var(--pr) 0 var(--px)",
      }}
    >
      <div data-rv="1" style={rv.r1}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            paddingBottom: "20px",
          }}
        >
          {clChips.map((c: any, i40: number) => (
            <Fragment key={i40}>
              <Button variant="custom" onClick={c.go} style={c.st}>
                {c.l}
              </Button>
            </Fragment>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 0",
            borderTop: "1px solid var(--line)",
            fontSize: "14px",
            color: "var(--ink2)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "11px",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--amber)",
              border: "1px dashed var(--amber)",
              borderRadius: "999px",
              padding: "2px 9px",
            }}
          >
            Placeholder
          </span>
          Sample entries based on the current product. Dates are placeholders.
        </div>
      </div>
      {entries.map((e: any, i41: number) => (
        <Fragment key={i41}>
          <div data-rv={e.rvk} style={e.rv}>
            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "var(--clCols)",
                gap: "12px 40px",
                padding: "36px 0",
                borderTop: "1px solid var(--line2)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "41px",
                  left: "calc(var(--tx) - var(--px) - 4.5px)",
                }}
              >
                <div data-nd={e.k} style={e.nd}></div>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "13px",
                  color: "var(--ink2)",
                  paddingTop: "2px",
                }}
              >
                {e.d}
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxWidth: "640px",
                }}
              >
                <span
                  style={{
                    fontSize: "22px",
                    fontWeight: "600",
                    letterSpacing: "-0.015em",
                    lineHeight: "1.25",
                  }}
                >
                  {e.t}
                </span>
                <span
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.55",
                    color: "var(--ink2)",
                    textWrap: "pretty",
                  }}
                >
                  {e.x}
                </span>
              </div>
              <span style={e.tag}>{e.mod}</span>
            </div>
          </div>
        </Fragment>
      ))}
      {clEmpty ? (
        <div
          style={{
            padding: "48px 0",
            borderTop: "1px solid var(--line2)",
            fontSize: "16px",
            color: "var(--ink2)",
          }}
        >
          No entries for this module yet.
        </div>
      ) : null}
    </section>
  );
}
