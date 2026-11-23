import type { CSSProperties } from "react";
import { MONO } from "../landing-styles";
import { HeroHeading } from "./hero-heading";
import { HeroWindowSidebar } from "./hero-window-sidebar";
import { HeroWindowFocus } from "./hero-window-focus";
import { HeroWindowStatus } from "./hero-window-status";

export function HeroSection({
  fill,
  node,
  rise,
  timer,
  ringPct,
  reduced,
  pulseAt,
}: {
  fill: (key: "hero") => CSSProperties;
  node: (key: "hero") => CSSProperties;
  rise: (ms: number) => CSSProperties;
  timer: string;
  ringPct: number;
  reduced: boolean;
  pulseAt: number;
}) {
  return (
    <section
      id="top"
      style={{
        position: "relative",
        padding: "120px var(--pr) 0 var(--px)",
        overflow: "hidden",
      }}
    >
      <HeroHeading fill={fill} node={node} rise={rise} />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--heroGap)",
          marginTop: 56,
          alignItems: "flex-start",
          ...rise(180),
        }}
      >
        <div
          style={{
            flex: "none",
            width: "var(--shotW)",
            maxWidth: "100%",
            position: "relative",
            marginBottom: -90,
          }}
        >
          <div
            aria-hidden="true"
            className="l-breathe"
            style={{
              position: "absolute",
              left: "-10%",
              right: "-10%",
              bottom: -120,
              height: 640,
              background:
                "radial-gradient(closest-side, var(--halo), transparent)",
              pointerEvents: "none",
            }}
          />
          <div
            role="img"
            aria-label="The Today screen: a running task, what is next, the day ring and the team pulse"
            style={{
              position: "relative",
              borderRadius: 28,
              border: "1px solid var(--line)",
              background: "var(--frame)",
              boxShadow: "var(--frame-shadow, var(--shadow))",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 44,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 18px",
                borderBottom: "1px solid var(--line2)",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 99,
                    background: "var(--line)",
                  }}
                />
              ))}
              <span
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontFamily: MONO,
                  fontSize: 12,
                  color: "var(--ink3)",
                }}
              >
                fernway.zentro.app / today
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: "var(--ink3)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "2px 6px",
                }}
              >
                ⌘K
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "var(--shotCols)",
                minHeight: 620,
              }}
            >
              <HeroWindowSidebar />
              <div
                style={{
                  padding: "26px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                  minWidth: 0,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      color: "var(--ink3)",
                    }}
                  >
                    Wed · Oct 14
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-bricolage), sans-serif",
                      fontWeight: 700,
                      fontSize: 28,
                      letterSpacing: "-0.03em",
                      marginTop: 4,
                    }}
                  >
                    Good morning, Mira
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  <HeroWindowFocus timer={timer} />
                  <HeroWindowStatus
                    ringPct={ringPct}
                    reduced={reduced}
                    pulseAt={pulseAt}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
