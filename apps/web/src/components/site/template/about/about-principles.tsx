/* eslint-disable @typescript-eslint/no-explicit-any */

export function AboutPrinciples({ v }: { v: any }) {
  const { rv } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "var(--sec) var(--pr) 0 var(--px)",
      }}
    >
      <div data-rv="1" style={rv.r1}>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "12px",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          01 · How we build it
        </span>
        <div
          style={{
            marginTop: "28px",
            borderTop: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "var(--abCols)",
              gap: "10px 64px",
              padding: "28px 0",
              borderBottom: "1px solid var(--line2)",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: "600",
                letterSpacing: "-0.01em",
              }}
            >
              One workspace
            </span>
            <span
              style={{
                fontSize: "17px",
                lineHeight: "1.6",
                color: "var(--ink2)",
                maxWidth: "640px",
                textWrap: "pretty",
              }}
            >
              Every module shares the same people, roles, search and audit log.
              A task, its doc and its owner are one search away, and access is
              set once.
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "var(--abCols)",
              gap: "10px 64px",
              padding: "28px 0",
              borderBottom: "1px solid var(--line2)",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: "600",
                letterSpacing: "-0.01em",
              }}
            >
              One module at a time
            </span>
            <span
              style={{
                fontSize: "17px",
                lineHeight: "1.6",
                color: "var(--ink2)",
                maxWidth: "640px",
                textWrap: "pretty",
              }}
            >
              Seven modules are live. Eleven more are on the public roadmap. Each
              one ships into the same workspace instead of as a separate product.
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "var(--abCols)",
              gap: "10px 64px",
              padding: "28px 0",
              borderBottom: "1px solid var(--line2)",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: "600",
                letterSpacing: "-0.01em",
              }}
            >
              Only what is live
            </span>
            <span
              style={{
                fontSize: "17px",
                lineHeight: "1.6",
                color: "var(--ink2)",
                maxWidth: "640px",
                textWrap: "pretty",
              }}
            >
              Pages on this site describe what works today. Anything coming is
              marked as coming, and nothing gets a date until it is ready.
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "var(--abCols)",
              gap: "10px 64px",
              padding: "28px 0",
              borderBottom: "1px solid var(--line2)",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "20px",
                fontWeight: "600",
                letterSpacing: "-0.01em",
              }}
            >
              Team
            </span>
            <span
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                alignItems: "center",
                fontSize: "16px",
                lineHeight: "1.6",
                color: "var(--ink3)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "11px",
                  letterSpacing: ".06em",
                  color: "var(--amber)",
                  border: "1px dashed var(--amber)",
                  borderRadius: "999px",
                  padding: "2px 9px",
                }}
              >
                PLACEHOLDER
              </span>
              Add who is behind Zentro, where you are based and when you started.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
