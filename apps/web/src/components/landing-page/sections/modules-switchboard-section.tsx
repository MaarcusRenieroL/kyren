import type { CSSProperties } from "react";
import { CHIPS, type ThreadKey } from "../landing-data";
import { DISPLAY, MONO, accentWord, dashed } from "../landing-styles";
import { SwitchboardCard } from "./switchboard-card";

export function ModulesSwitchboardSection({
  fill,
  node,
  m,
  ce,
  merged,
  sc,
  trans,
}: {
  fill: (key: ThreadKey) => CSSProperties;
  node: (key: ThreadKey) => CSSProperties;
  m: boolean;
  ce: number;
  merged: Array<[number, number]>;
  sc: number;
  trans?: string;
}) {
  return (
    <section
      id="product"
      style={{
        position: "relative",
        height: "var(--s2H)",
        paddingBottom: "var(--s2PB)",
        background: "var(--band)",
        borderTop: "1px solid var(--line2)",
        borderBottom: "1px solid var(--line2)",
        overflow: "hidden",
        scrollMarginTop: 64,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 0.75px)",
          top: 0,
          height: "var(--lineY)",
          width: 1.5,
          ...dashed("v"),
        }}
      >
        <div style={fill("s2a")} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "var(--tx)",
          top: "var(--lineY)",
          width: "var(--s2bW)",
          height: 1.5,
          ...dashed("h"),
        }}
      >
        <div style={fill("s2b")} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--s2cX) - 0.75px)",
          top: "var(--s2cT)",
          bottom: 0,
          width: 1.5,
          ...dashed("v"),
        }}
      >
        <div style={fill("s2c")} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 4.5px)",
          top: "calc(var(--lineY) - 3.75px)",
        }}
      >
        <div style={node("s2b")} />
      </div>

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "var(--chL)",
          top: "var(--chT)",
          width: "var(--chW)",
          height: "var(--chH)",
        }}
      >
        {CHIPS.map(([name, width, sx0, sy0, rot], i) => {
          const sx = m ? sx0 * 0.66 : sx0;
          const sy = m ? sy0 * 0.62 : sy0;
          const x = sx + (merged[i]![0] - sx) * ce;
          const y = sy + (merged[i]![1] - sy) * ce;

          return (
            <div
              key={name}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width,
                transformOrigin: "0 0",
                transform: `translate(${x}px,${y}px) rotate(${rot * (1 - ce)}deg) scale(${sc})`,
                transition: trans ?? "transform .5s cubic-bezier(.2,.7,.2,1)",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 34,
                  borderRadius: 999,
                  border: "1px solid var(--line)",
                  background: "var(--tile)",
                  boxShadow: "var(--shadow)",
                  fontFamily: MONO,
                  fontSize: 13,
                  color: "var(--ink2)",
                }}
              >
                {name}
              </span>
            </div>
          );
        })}
      </div>

      <SwitchboardCard ce={ce} trans={trans} />

      <div
        style={{
          position: "var(--txPos)" as CSSProperties["position"],
          left: "var(--txL)",
          right: "var(--txR)",
          top: "var(--txT)",
          transform: "var(--txTr)",
          margin: "var(--txM)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: "var(--h2)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            textWrap: "balance",
          }}
        >
          Ten tools become one <em style={accentWord}>workspace</em>.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--ink2)",
            textWrap: "pretty",
          }}
        >
          Your tracker, wiki, drive, chat, mail, calendar, HR, payroll,
          support desk and forms become modules that share one organization,
          one search and one activity log.
        </p>
        <span
          style={{ fontFamily: MONO, fontSize: 12, color: "var(--ink3)" }}
        >
          A ticket can link to a task, and a meeting action item can become one.
        </span>
      </div>
    </section>
  );
}
