import type { CSSProperties } from "react";
import { AUDIT, type ThreadKey } from "../landing-data";
import { MONO, dashed, label, nodeStyle } from "../landing-styles";

export function AuditLogTimeline({
  m,
  fill,
  auditProgress,
}: {
  m: boolean;
  fill: (key: ThreadKey) => CSSProperties;
  auditProgress: number;
}) {
  return (
    <div
      style={{
        position: "relative",
        margin: "72px calc(-1 * var(--pr)) 0 calc(-1 * var(--px))",
        padding: "0 var(--pr) 0 var(--px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          paddingBottom: 20,
        }}
      >
        <span style={label}>Audit log</span>
        <span
          style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink3)" }}
        >
          Today · Oct 14
        </span>
      </div>
      {!m ? (
        <div style={{ position: "relative" }}>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "calc(var(--tx) - var(--px))",
              right: 0,
              top: 4,
              height: 1.5,
              ...dashed("h"),
            }}
          >
            <div style={fill("s5x")} />
          </div>
          <ol
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(5,minmax(0,1fr))",
              gap: 24,
              margin: 0,
              padding: 0,
              listStyle: "none",
            }}
          >
            {AUDIT.map(([time, who, what], i) => (
              <li
                key={time}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    ...nodeStyle(auditProgress >= (i + 0.5) / 5),
                    position: "relative",
                    zIndex: 1,
                  }}
                />
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    color: "var(--ink3)",
                    marginTop: 8,
                  }}
                >
                  {time}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: 1.45,
                    color: "var(--ink2)",
                  }}
                >
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                    {who}
                  </span>{" "}
                  {what}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <ol
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {AUDIT.map(([time, who, what], i) => (
            <li
              key={time}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "calc(var(--tx) - var(--px) - 4.5px)",
                  top: 4,
                  ...nodeStyle(auditProgress >= (i + 0.5) / 5),
                }}
              />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  color: "var(--ink3)",
                }}
              >
                {time}
              </span>
              <span
                style={{
                  fontSize: 14,
                  lineHeight: 1.45,
                  color: "var(--ink2)",
                }}
              >
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                  {who}
                </span>{" "}
                {what}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
