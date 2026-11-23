import type { CSSProperties } from "react";
import { MONO, label } from "../landing-styles";

export function HeroWindowSidebar() {
  return (
    <div
      style={{
        display: "var(--sbD)" as CSSProperties["display"],
        borderRight: "1px solid var(--line2)",
        padding: "18px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 8px 18px",
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: "var(--peach)",
            border: "1px solid var(--line)",
            fontFamily: MONO,
            fontSize: 11,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          F
        </span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Fernway</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          fontSize: 14,
        }}
      >
        {[
          ["Today", true, ""],
          ["Projects", false, ""],
          ["Tasks", false, "8"],
          ["Docs", false, ""],
          ["Teams", false, ""],
        ].map(([name, active, count]) => (
          <div
            key={String(name)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 34,
              padding: "0 10px",
              borderRadius: 10,
              background: active ? "var(--tile2)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink2)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: active ? "var(--ink)" : "transparent",
                border: active ? "none" : "1px solid var(--ink3)",
              }}
            />
            {name}
            {count ? (
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: MONO,
                  fontSize: 11,
                  color: "var(--ink3)",
                }}
              >
                {count}
              </span>
            ) : null}
          </div>
        ))}
        <div
          style={{
            ...label,
            fontSize: 10,
            padding: "18px 10px 6px",
          }}
        >
          Collaboration
        </div>
        {["Chat", "Calendar"].map((name) => (
          <div
            key={name}
            data-dim=""
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 34,
              padding: "0 10px",
              color: "var(--ink3)",
              opacity: 0.6,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                border: "1px dashed var(--ink3)",
              }}
            />
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
