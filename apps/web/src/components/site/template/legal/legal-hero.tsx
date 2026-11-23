/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@kyren/ui/shadcn/button";
import { Fragment } from "react";

export function LegalHero({ v }: { v: any }) {
  const { nd, rv, L, legalTabs } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "var(--heroT) var(--pr) 0 var(--px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 4.5px)",
          top: "calc(var(--heroT) + 4px)",
        }}
      >
        <div data-nd="k0" style={nd.k0}></div>
      </div>
      <div data-rv="0" style={rv.r0}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "12px",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--ink3)",
            }}
          >
            Legal
          </span>
          <h1
            style={{
              margin: "0",
              fontFamily:
                "var(--font-bricolage), var(--font-geist), sans-serif",
              fontWeight: "700",
              fontSize: "var(--h1)",
              lineHeight: "0.98",
              letterSpacing: "-0.04em",
            }}
          >
            {L.pre}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              {L.em}
            </em>
            {L.post}
          </h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px 32px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "2px",
                flexWrap: "wrap",
                maxWidth: "100%",
                padding: "3px",
                border: "1px solid var(--line)",
                borderRadius: "16px",
              }}
            >
              {legalTabs.map((b: any, i42: number) => (
                <Fragment key={i42}>
                  <Button variant="custom" style={b.st} onClick={b.go}>
                    {b.l}
                  </Button>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
