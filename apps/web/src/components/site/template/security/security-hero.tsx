/* eslint-disable @typescript-eslint/no-explicit-any */
import { hrefOf } from "../common";

export function SecurityHero({ v }: { v: any }) {
  const { nd, rv, go } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "var(--heroT) var(--pr) 0 var(--px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "0",
          bottom: "0",
          left: "58%",
          width: "200px",
          background: "linear-gradient(to bottom, transparent, var(--beam) 45%, transparent)",
          pointerEvents: "none",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          top: "-240px",
          left: "35%",
          width: "1000px",
          height: "800px",
          background: "radial-gradient(closest-side, var(--wash), transparent)",
          pointerEvents: "none",
        }}
      ></div>
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
            position: "relative",
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
            Security · what is live today
          </span>
          <h1
            style={{
              margin: "0",
              maxWidth: "1080px",
              fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
              fontWeight: "700",
              fontSize: "var(--h1)",
              lineHeight: "0.98",
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            One permission{" "}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              system
            </em>
            , and a log of every change.
          </h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "32px 64px",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <p
              style={{
                margin: "0",
                maxWidth: "580px",
                fontSize: "var(--lead)",
                lineHeight: "1.5",
                color: "var(--ink2)",
                textWrap: "pretty",
              }}
            >
              This page covers what Zentro does today: roles that
              apply across every module, access that carries from a
              project to its work, and an audit log of every change.
              It lists nothing that is not live.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <a
                href={hrefOf(go.about)}
                onClick={go.about}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
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
                Ask a security question
              </a>
              <a
                href="#roles"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: "48px",
                  padding: "0 22px",
                  borderRadius: "999px",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                  fontSize: "15px",
                  fontWeight: "500",
                  textDecoration: "none",
                }}
              >
                See the roles
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
