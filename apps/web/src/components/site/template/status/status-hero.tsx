/* eslint-disable @typescript-eslint/no-explicit-any */

export function StatusHero({ v }: { v: any }) {
  const { nd, rv, stDot, ok, inc } = v;

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
            gap: "28px",
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
            Status · Oct 15, 2026 · 11:24 UTC
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
            }}
          >
            <span style={stDot}></span>
            {ok ? (
              <h1
                style={{
                  margin: "0",
                  fontFamily:
                    "var(--font-bricolage), var(--font-geist), sans-serif",
                  fontWeight: "700",
                  fontSize: "var(--h1)",
                  lineHeight: "0.98",
                  letterSpacing: "-0.04em",
                  textWrap: "balance",
                }}
              >
                All systems{" "}
                <em
                  style={{
                    fontFamily: "var(--font-instrument-serif), serif",
                    fontStyle: "italic",
                    fontWeight: "400",
                    fontSize: "1.1em",
                    letterSpacing: "-0.01em",
                  }}
                >
                  operational
                </em>
                .
              </h1>
            ) : null}
            {inc ? (
              <h1
                style={{
                  margin: "0",
                  fontFamily:
                    "var(--font-bricolage), var(--font-geist), sans-serif",
                  fontWeight: "700",
                  fontSize: "var(--h1)",
                  lineHeight: "0.98",
                  letterSpacing: "-0.04em",
                  textWrap: "balance",
                }}
              >
                Search is{" "}
                <em
                  style={{
                    fontFamily: "var(--font-instrument-serif), serif",
                    fontStyle: "italic",
                    fontWeight: "400",
                    fontSize: "1.1em",
                    letterSpacing: "-0.01em",
                  }}
                >
                  degraded
                </em>
                .
              </h1>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "24px 64px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {ok ? (
              <p
                style={{
                  margin: "0",
                  maxWidth: "560px",
                  fontSize: "var(--lead)",
                  lineHeight: "1.5",
                  color: "var(--ink2)",
                }}
              >
                Every live module is working normally.
              </p>
            ) : null}
            {inc ? (
              <p
                style={{
                  margin: "0",
                  maxWidth: "560px",
                  fontSize: "var(--lead)",
                  lineHeight: "1.5",
                  color: "var(--ink2)",
                }}
              >
                Some workspaces see slow search results. Everything else is
                working normally.
              </p>
            ) : null}
            <a
              href="#"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "48px",
                padding: "0 24px",
                borderRadius: "999px",
                background: "var(--btn)",
                color: "var(--btn-ink)",
                fontSize: "15px",
                fontWeight: "500",
                textDecoration: "none",
              }}
            >
              Subscribe to updates
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
