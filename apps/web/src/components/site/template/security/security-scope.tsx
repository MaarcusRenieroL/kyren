/* eslint-disable @typescript-eslint/no-explicit-any */
import { hrefOf } from "../common";

export function SecurityScope({ v }: { v: any }) {
  const { nd, rv, go, ico } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "var(--sec) var(--pr) 0 var(--px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 4.5px)",
          top: "calc(var(--sec) + 4px)",
        }}
      >
        <div data-nd="k4" style={nd.k4}></div>
      </div>
      <div data-rv="4" style={rv.r4}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "760px",
            padding: "32px 0 0",
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
            04 · Scope of this page
          </span>
          <h2
            style={{
              margin: "0",
              fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
              fontWeight: "700",
              fontSize: "var(--h2)",
              lineHeight: "1",
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            What this page does not{" "}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              cover
            </em>
            .
          </h2>
          <p
            style={{
              margin: "0",
              fontSize: "17px",
              lineHeight: "1.55",
              color: "var(--ink2)",
              textWrap: "pretty",
            }}
          >
            Certifications, single sign-on, two-factor sign-in and encryption are
            not described here. If your team needs answers on any of them before
            signing up, send us a question and we will tell you where each one
            stands.
          </p>
          <a
            href={hrefOf(go.about)}
            onClick={go.about}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              height: "44px",
              padding: "0 20px",
              borderRadius: "999px",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              fontSize: "14px",
              fontWeight: "500",
              textDecoration: "none",
              marginTop: "8px",
            }}
          >
            Ask a security question<span style={ico.arrow}></span>
          </a>
        </div>
      </div>
    </section>
  );
}
