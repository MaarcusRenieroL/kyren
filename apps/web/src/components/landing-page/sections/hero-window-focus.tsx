import { DISPLAY, MONO, label, stateChip } from "../landing-styles";

export function HeroWindowFocus({ timer }: { timer: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 18,
          background: "var(--tile)",
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={label}>Focus</span>
          <span style={stateChip("var(--amber)")}>In progress</span>
        </div>
        <div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: "var(--ink3)",
            }}
          >
            ZEN-142 · Onboarding v2
          </div>
          <div
            style={{
              fontSize: 21,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              marginTop: 6,
            }}
          >
            Ship onboarding checklist v2
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 44,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {timer}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                fontFamily: MONO,
                fontSize: 11,
                color: "var(--amber)",
              }}
            >
              <span
                data-dim=""
                className="l-blink"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: "var(--amber)",
                }}
              />
              Running since 08:51
            </div>
          </div>
          <span
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Pause
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              background: "var(--line2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "66%",
                height: "100%",
                background: "var(--ink2)",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: "var(--ink3)",
            }}
          >
            4/6 subtasks
          </span>
        </div>
      </div>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 18,
          background: "var(--tile)",
          padding: "8px 8px 6px",
        }}
      >
        <div style={{ ...label, padding: "10px 12px 8px" }}>Up next</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 12,
            background: "var(--tile2)",
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: "var(--ink3)",
            }}
          >
            ZEN-145
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Release notes for Docs permissions
          </span>
          <span
            style={{
              height: 28,
              padding: "0 14px",
              borderRadius: 999,
              background: "var(--btn)",
              color: "var(--btn-ink)",
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Start
          </span>
        </div>
        {[
          [
            "ZEN-139",
            "Review Teams invite flow",
            "In review",
            "var(--cyan)",
          ],
          [
            "ZEN-127",
            "Audit log CSV export",
            "Overdue",
            "var(--rose)",
          ],
        ].map(([key, title, state, color]) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 12,
                color: "var(--ink3)",
              }}
            >
              {key}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </span>
            <span style={stateChip(color!)}>{state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
