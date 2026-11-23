import type { CSSProperties } from "react";
import { GROUPS, type ThreadKey } from "../landing-data";
import {
  DISPLAY,
  MONO,
  accentWord,
  dashed,
  nodeStyle,
  solidLine,
} from "../landing-styles";
import { ModuleCard } from "./module-card";

export function ModulesCatalogSection({
  fill,
  f,
  m,
}: {
  fill: (key: ThreadKey) => CSSProperties;
  f: Record<ThreadKey, number>;
  m: boolean;
}) {
  return (
    <section
      id="modules"
      style={{
        position: "relative",
        padding: "var(--sec) var(--pr) 0 var(--px)",
        scrollMarginTop: 64,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 0.75px)",
          top: 0,
          bottom: 0,
          width: 1.5,
          ...dashed("v"),
        }}
      >
        <div style={fill("s4")} />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 32,
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <h2
          style={{
            margin: 0,
            maxWidth: 680,
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: "var(--h2)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            textWrap: "balance",
          }}
        >
          Switch on only the <em style={accentWord}>modules</em> you use.
        </h2>
        <div
          style={{
            maxWidth: 380,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--ink2)",
            }}
          >
            Each module joins the same workspace. Turn one on and it already
            knows your people, roles and projects.
          </p>
          <div
            style={{
              display: "flex",
              gap: 16,
              fontFamily: MONO,
              fontSize: 12,
              color: "var(--ink2)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: "var(--green)",
                }}
              />
              {GROUPS.reduce((count, group) => count + group[2].length, 0)} modules
            </span>

          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 56,
          marginTop: 88,
        }}
      >
        {GROUPS.map(([name, tint, tiles], gi) => {
          const on = f.s4 >= (gi + 1) / 5;
          const live = tiles.filter((t) => t[3]).length;

          return (
            <div
              key={name}
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "var(--gCols)",
                gap: "20px 32px",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 52,
                  left: "calc(var(--tx) - var(--px))",
                  width: "calc(var(--px) - var(--tx) - 12px)",
                  height: 1.5,
                  ...(on ? solidLine : dashed("h")),
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 48.25,
                  left: "calc(var(--tx) - var(--px) - 4.5px)",
                  ...nodeStyle(on),
                }}
              />
              <div
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    letterSpacing: ".06em",
                    color: "var(--ink3)",
                  }}
                >
                  0{gi + 1}
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: DISPLAY,
                    fontWeight: 700,
                    fontSize: 28,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {name}
                </h3>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    color: "var(--ink3)",
                  }}
                >
                  {live} modules
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(var(--bCols), minmax(0,1fr))",
                  gridAutoRows: "var(--bRow)",
                  gridAutoFlow: "dense",
                  gap: 12,
                }}
              >
                {tiles.map((tile) => (
                  <ModuleCard
                    key={tile[0]}
                    tile={tile}
                    tint={tint}
                    m={m}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p
        style={{
          margin: "56px 0 0",
          maxWidth: 820,
          fontSize: 17,
          lineHeight: 1.55,
          color: "var(--ink2)",
          paddingLeft: "var(--repPL)",
          textWrap: "pretty",
        }}
      >
        Replaces the issue tracker, wiki, file drive, team chat, shared
        inbox, calendar, HR and payroll software, help desk and form builder
        you pay for separately.
      </p>
    </section>
  );
}
