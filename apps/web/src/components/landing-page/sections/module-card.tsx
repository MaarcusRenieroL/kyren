import { PREVIEWS, type ModuleTile } from "../landing-data";
import { MONO } from "../landing-styles";

export function ModuleCard({
  tile,
  tint,
  m,
}: {
  tile: ModuleTile;
  tint: string;
  m: boolean;
}) {
  const [tn, ic, line, isLive, cols, rows, mcols, prev, tintOverride] = tile;
  const showPrev = prev && !(m && prev === "docs");

  return (
    <div
      data-dim={isLive ? undefined : ""}
      className={isLive ? "l-lift" : undefined}
      style={{
        gridColumn: `span ${m ? mcols : cols}`,
        gridRow: !m && rows > 1 ? `span ${rows}` : "auto",
        display: "flex",
        opacity: isLive ? 1 : 0.5,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--tile)",
          backgroundImage: "var(--glass)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          boxShadow: "var(--shadow)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 52,
            flex: "none",
            background: tintOverride ?? tint,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px 0 11px",
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "var(--chip-bg)",
              border: "1px solid var(--line2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            {ic}
          </span>
          {isLive ? (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: "var(--ink)",
                background: "var(--chip-bg)",
                borderRadius: 999,
                padding: "3px 9px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ● Live
            </span>
          ) : (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: "var(--ink2)",
                border: "1px dashed var(--ink3)",
                borderRadius: 999,
                padding: "2px 9px",
              }}
            >
              Coming
            </span>
          )}
        </div>
        <div
          style={{
            padding: "14px 18px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {tn}
          </span>
          <span
            style={{
              fontSize: 14,
              lineHeight: 1.45,
              color: "var(--ink2)",
              textWrap: "pretty",
            }}
          >
            {line}
          </span>
          {showPrev ? (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {PREVIEWS[prev]!.map(([a, b, s, color]) => (
                <div
                  key={a}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderTop: "1px solid var(--line2)",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      color: "var(--ink3)",
                    }}
                  >
                    {b}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      color: color || "var(--ink3)",
                      ...(color
                        ? {
                            background: `color-mix(in oklab, ${color} 15%, transparent)`,
                            padding: "2px 8px",
                            borderRadius: 999,
                          }
                        : {}),
                    }}
                  >
                    {s}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
