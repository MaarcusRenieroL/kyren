/* eslint-disable @typescript-eslint/no-explicit-any */

export function StatusPastIncidents({ v }: { v: any }) {
  const { rv } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "72px var(--pr) var(--sec) var(--px)",
      }}
    >
      <div data-rv="3" style={rv.r3}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
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
            Past incidents
          </span>
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
            Sample
          </span>
        </div>
        <div
          style={{
            marginTop: "16px",
            borderTop: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "var(--clCols)",
              gap: "8px 40px",
              padding: "20px 0",
              borderBottom: "1px solid var(--line2)",
              alignItems: "start",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "13px",
                color: "var(--ink2)",
              }}
            >
              Oct 2, 2026
            </span>
            <span style={{ fontSize: "15px", lineHeight: "1.55" }}>
              Saving edits in Docs was delayed for some workspaces.
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                color: "var(--green)",
              }}
            >
              Resolved
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
