import type { CSSProperties } from "react";
import type { ThreadKey } from "../landing-data";
import { DISPLAY, accentWord, dashed } from "../landing-styles";
import { RolesMatrixTable } from "./roles-matrix-table";
import { ModulesSwitchPanel } from "./modules-switch-panel";
import { AuditLogTimeline } from "./audit-log-timeline";

export function ControlSection({
  fill,
  mx,
  trans,
  m,
  auditProgress,
}: {
  fill: (key: ThreadKey) => CSSProperties;
  mx: number;
  trans?: string;
  m: boolean;
  auditProgress: number;
}) {
  return (
    <section
      id="control"
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
        <div style={fill("s5")} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: 760,
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
          One permission <em style={accentWord}>system</em> for every module.
        </h2>
        <p
          style={{
            margin: 0,
            maxWidth: 520,
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--ink2)",
            textWrap: "pretty",
          }}
        >
          Roles apply across the workspace, so access to a project carries to its
          tasks and docs. Every change is written to the audit log.
        </p>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "flex-start",
          marginTop: 64,
        }}
      >
        <RolesMatrixTable mx={mx} />
        <ModulesSwitchPanel
          trans={trans}
        />
      </div>

      <AuditLogTimeline
        m={m}
        fill={fill}
        auditProgress={auditProgress}
      />
      <div style={{ height: "var(--sec)" }} />
    </section>
  );
}
