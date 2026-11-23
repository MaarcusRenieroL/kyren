import type { CSSProperties } from "react";
import type { ThreadKey } from "../landing-data";
import { DISPLAY, accentWord, dashed } from "../landing-styles";
import { AttachedTaskCard } from "./attached-task-card";
import { AttachedItemsGrid } from "./attached-items-grid";

export function AttachedSection({
  fill,
  attached,
  m,
  attOn,
  trans,
}: {
  fill: (key: ThreadKey) => CSSProperties;
  attached: number;
  m: boolean;
  attOn: boolean[];
  trans?: string;
}) {
  return (
    <section style={{ position: "relative" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--s3x) - 0.75px)",
          top: 0,
          bottom: 0,
          width: 1.5,
          ...dashed("v"),
        }}
      >
        <div style={fill("s3a")} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "var(--tx)",
          bottom: 0,
          width: "calc(var(--s3x) - var(--tx))",
          height: 1.5,
          ...dashed("h"),
        }}
      >
        <div style={fill("s3b")} />
      </div>
      <div
        style={{
          position: "relative",
          padding: "var(--sec) var(--pr) 0 var(--px)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: "var(--s3HW)",
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
          One task, everything <em style={accentWord}>attached</em>.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--ink2)",
            textWrap: "pretty",
          }}
        >
          A Kyren task knows the doc it was written from, its files, the
          message that changed it, the meeting where it was decided and the
          ticket behind it.
        </p>
      </div>

      <AttachedTaskCard attached={attached} />

      <AttachedItemsGrid m={m} attOn={attOn} trans={trans} />
    </section>
  );
}
