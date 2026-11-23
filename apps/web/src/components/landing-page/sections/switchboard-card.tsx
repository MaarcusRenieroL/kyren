import type { CSSProperties } from "react";
import { MONO, logoMark } from "../landing-styles";

export function SwitchboardCard({ ce, trans }: { ce: number; trans?: string }) {
  return (
    <div
      style={{
        position: "var(--tlPos)" as CSSProperties["position"],
        left: "var(--tlL)",
        top: "var(--tlT)",
        width: "var(--tlW)",
        height: "var(--tlH)",
        margin: "var(--tlM)",
        zIndex: 2,
      }}
    >
      <div
        style={{
          height: "100%",
          opacity: 0.45 + 0.55 * ce,
          transform: `scale(${0.97 + 0.03 * ce})`,
          transition: trans ?? "all .5s",
        }}
      >
        <div
          style={{
            height: "100%",
            backgroundColor: "var(--tile)",
            backgroundImage: "var(--glass)",
            border: "1px solid var(--line)",
            borderRadius: 28,
            boxShadow: "var(--shadow)",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {logoMark(26, 8, 14)}
            <span style={{ fontSize: 15, fontWeight: 600 }}>Fernway</span>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: MONO,
                fontSize: 11,
                color: "var(--ink3)",
              }}
            >
              Example workspace
            </span>
          </div>
          <div
            style={{
              height: 36,
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--tile2)",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              fontSize: 13,
              color: "var(--ink3)",
            }}
          >
            Search everything
            <span
              style={{
                marginLeft: "auto",
                fontFamily: MONO,
                fontSize: 11,
              }}
            >
              ⌘K
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "7px 12px",
              fontSize: 13,
            }}
          >
            {[
              "Projects",
              "Files",
              "Tasks",
              "Chat",
              "Docs",
              "Messages",
              "Teams",
              "Calendar",
              "Roles",
              "HR",
              "Audit log",
              "Tickets",
            ].map((name) => (
              <span
                key={name}
                style={{ display: "flex", alignItems: "center", gap: 7 }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: "var(--green)",
                  }}
                />
                {name}
              </span>
            ))}
          </div>
          <div
            style={{
              marginTop: "auto",
              paddingTop: 12,
              borderTop: "1px solid var(--line2)",
              fontFamily: MONO,
              fontSize: 11,
              color: "var(--ink3)",
            }}
          >
            1 org · 1 permission system · 1 search · 1 log
          </div>
        </div>
      </div>
    </div>
  );
}
