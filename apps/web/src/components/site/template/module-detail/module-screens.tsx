/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleScreenOne } from "./module-screen-one";
import { ModuleScreenTwo } from "./module-screen-two";
import { ModuleScreenThree } from "./module-screen-three";

export function ModuleScreens({ v }: { v: any }) {
  const { nd, rv } = v;

  return (
    <section
      style={{
        position: "relative",
        padding: "var(--sec) var(--pr) 0 var(--px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 4.5px)",
          top: "calc(var(--sec) + 4px)",
        }}
      >
        <div data-nd="k1" style={nd.k1}></div>
      </div>
      <div data-rv="1" style={rv.r1}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "720px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "12px",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--ink3)",
            }}
          >
            01 · In the product
          </span>
          <h2
            style={{
              margin: "0",
              fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
              fontWeight: "700",
              fontSize: "var(--h2)",
              lineHeight: "1",
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            Three screens from the{" "}
            <em
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                fontWeight: "400",
                fontSize: "1.1em",
                letterSpacing: "-0.01em",
              }}
            >
              app
            </em>
            .
          </h2>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "48px",
            marginTop: "56px",
          }}
        >
          <ModuleScreenOne v={v} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "var(--two)",
              gap: "48px 32px",
              alignItems: "start",
            }}
          >
            <ModuleScreenTwo v={v} />
            <ModuleScreenThree v={v} />
          </div>
        </div>
      </div>
    </section>
  );
}
