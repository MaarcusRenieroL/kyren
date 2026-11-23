/* eslint-disable @typescript-eslint/no-explicit-any */
import { AboutContactForm } from "./about-contact-form";

export function AboutContact({ v }: { v: any }) {
  const { rv } = v;

  return (
    <section
      id="contact"
      style={{
        position: "relative",
        padding: "var(--sec) var(--pr) var(--sec) var(--px)",
      }}
    >
      <div data-rv="2" style={rv.r2}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "var(--lkCols)",
            gap: "40px 64px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
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
              02 · Contact
            </span>
            <h2
              style={{
                margin: "0",
                fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
                fontWeight: "700",
                fontSize: "var(--h2)",
                lineHeight: "1",
                letterSpacing: "-0.04em",
              }}
            >
              Write to{" "}
              <em
                style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  fontStyle: "italic",
                  fontWeight: "400",
                  fontSize: "1.1em",
                  letterSpacing: "-0.01em",
                }}
              >
                us
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
              Sales, support, security or anything else. Choose a topic so your
              message reaches the right person. We reply by email.
            </p>
          </div>
          <AboutContactForm v={v} />
        </div>
      </div>
    </section>
  );
}
