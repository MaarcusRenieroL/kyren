import type { CSSProperties } from "react";
import { ATTACHMENTS } from "../landing-data";
import { MONO, dashed, label, nodeStyle, solidLine } from "../landing-styles";

export function AttachedItemsGrid({
  m,
  attOn,
  trans,
}: {
  m: boolean;
  attOn: boolean[];
  trans?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "var(--attCols)",
        columnGap: 120,
        padding: "64px var(--attPR) var(--sec) var(--attPL)",
      }}
    >
      {ATTACHMENTS.map((a, i) => {
        const on = attOn[i]!;
        const col2 = !m && i % 2 === 1;
        const side: CSSProperties = m
          ? { left: -24, width: 24 }
          : col2
            ? { left: -60, width: 60 }
            : { right: -60, width: 60 };
        const nside: CSSProperties = m
          ? { left: -28.5 }
          : col2
            ? { left: -64.5 }
            : { right: -64.5 };

        return (
          <div
            key={a.kind}
            style={
              m
                ? {
                    gridColumn: "1",
                    position: "relative",
                    marginTop: i ? 28 : 0,
                  }
                : {
                    gridColumn: col2 ? "2" : "1",
                    gridRow: String(i + 1),
                    justifySelf: col2 ? "start" : "end",
                    width: "100%",
                    maxWidth: 380,
                    position: "relative",
                    marginTop: i ? -40 : 0,
                  }
            }
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 30,
                height: 1.5,
                ...side,
                ...(on ? solidLine : dashed("h")),
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 26.25,
                ...nside,
                ...nodeStyle(on),
              }}
            />
            <div
              data-dim={a.live ? undefined : ""}
              style={{
                opacity: on ? (a.live ? 1 : 0.6) : 0.28,
                transform: on
                  ? "none"
                  : `translateX(${m ? 16 : col2 ? 28 : -28}px)`,
                transition: trans ?? "all .5s cubic-bezier(.2,.7,.2,1)",
              }}
            >
              <div
                style={{
                  backgroundColor: "var(--tile)",
                  backgroundImage: "var(--glass)",
                  border: "1px solid var(--line)",
                  borderRadius: 20,
                  boxShadow: "var(--shadow)",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: a.tint,
                      border: "1px solid var(--line2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: MONO,
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    {a.icon}
                  </span>
                  <span style={label}>{a.kind}</span>
                  {a.live ? (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: MONO,
                        fontSize: 11,
                        color: "var(--green)",
                      }}
                    >
                      ● Live
                    </span>
                  ) : (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: MONO,
                        fontSize: 11,
                        color: "var(--ink3)",
                        border: "1px solid var(--line)",
                        borderRadius: 999,
                        padding: "1px 8px",
                      }}
                    >
                      Coming
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    lineHeight: 1.35,
                  }}
                >
                  {a.title}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: "var(--ink3)",
                  }}
                >
                  {a.meta}
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--ink2)",
                  padding: "10px 4px 0",
                }}
              >
                {a.caption}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
