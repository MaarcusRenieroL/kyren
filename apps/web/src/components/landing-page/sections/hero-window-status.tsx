import { DISPLAY, MONO } from "../landing-styles";
import { PULSE } from "../landing-data";

export function HeroWindowStatus({
  ringPct,
  reduced,
  pulseAt,
}: {
  ringPct: number;
  reduced: boolean;
  pulseAt: number;
}) {
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
          padding: 20,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            flex: "none",
            width: 104,
            height: 104,
            borderRadius: "50%",
            background: `conic-gradient(var(--green) 0 ${ringPct}%, var(--line) ${ringPct}% 100%)`,
            transition: reduced
              ? "none"
              : "background 1.4s cubic-bezier(.2,.7,.2,1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background: "var(--tile)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: "-0.03em",
              }}
            >
              5/8
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: "var(--ink3)",
              }}
            >
              DONE
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 7,
            fontFamily: MONO,
            fontSize: 12,
            color: "var(--ink2)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-geist), sans-serif",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            Your day
          </span>
          <span>3h 10m tracked</span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: "var(--amber)",
              }}
            />
            2 in progress
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: "var(--rose)",
              }}
            />
            1 overdue
          </span>
        </div>
      </div>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 18,
          background: "var(--tile)",
          padding: "18px 18px 8px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingBottom: 10,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600 }}>Team pulse</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: "var(--ink3)",
            }}
          >
            Onboarding v2
          </span>
        </div>
        {PULSE.map(([initials, name, task, dot, bg], pi) => (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 6px",
              margin: "0 -6px",
              borderRadius: 8,
              background:
                !reduced && pulseAt === pi ? "var(--tile2)" : "transparent",
              transition: "background .5s",
              borderTop: "1px solid var(--line2)",
            }}
          >
            <span
              style={{
                flex: "none",
                width: 30,
                height: 30,
                borderRadius: 99,
                background: bg,
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontSize: 10,
                color: "var(--ink)",
              }}
            >
              {initials}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: "var(--ink3)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {task}
              </div>
            </div>
            <span
              className={!reduced && pulseAt === pi ? "l-blink" : undefined}
              style={{
                flex: "none",
                width: 8,
                height: 8,
                borderRadius: 99,
                background: dot,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
