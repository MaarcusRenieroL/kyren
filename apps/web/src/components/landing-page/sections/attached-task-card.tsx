import { DISPLAY, MONO, label, stateChip } from "../landing-styles";

export function AttachedTaskCard({ attached }: { attached: number }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        width: "var(--taskW)",
        margin: "72px var(--taskMR) 0 var(--taskML)",
        backgroundColor: "var(--tile)",
        backgroundImage: "var(--glass)",
        border: "1px solid var(--line)",
        borderRadius: 20,
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 10, background: "var(--sky)" }} />
      <div
        style={{
          padding: "22px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 13,
              color: "var(--ink2)",
            }}
          >
            ZEN-142
          </span>
          <span style={stateChip("var(--amber)")}>In progress</span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: MONO,
              fontSize: 12,
              color: "var(--ink3)",
            }}
          >
            Onboarding v2
          </span>
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          Ship onboarding checklist v2
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: 12,
            paddingTop: 14,
            borderTop: "1px solid var(--line2)",
          }}
        >
          {[
            ["Assignee", "Mira Okafor", false],
            ["Due", "Oct 18", true],
            ["Tracked", "01:24:36", true],
          ].map(([name, value, mono]) => (
            <div key={String(name)}>
              <div style={{ ...label, fontSize: 10 }}>{name}</div>
              <div
                style={{
                  fontFamily: mono ? MONO : undefined,
                  fontSize: 14,
                  marginTop: 4,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: MONO,
            fontSize: 11,
            color: "var(--ink3)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              background: "var(--accent)",
            }}
          />
          {attached} of 5 linked
        </div>
      </div>
    </div>
  );
}
