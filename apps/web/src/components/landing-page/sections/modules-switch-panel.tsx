import { Switch } from "@zentro/ui/shadcn/switch";
import { Button } from "@zentro/ui/shadcn/button";
import { useState } from "react";
import { MONO } from "../landing-styles";

export function ModulesSwitchPanel({ trans }: { trans?: string }) {
  const [projects, setProjects] = useState<"enabled" | "confirm" | "disabled">(
    "enabled",
  );
  return (
    <div
      style={{
        flex: "0 1 380px",
        minWidth: 0,
        marginTop: "var(--panelMT)",
        backgroundColor: "var(--tile)",
        backgroundImage: "var(--glass)",
        border: "1px solid var(--line)",
        borderRadius: 20,
        boxShadow: "var(--shadow)",
        padding: "8px 8px 10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          padding: "12px 12px 10px",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Modules</span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: MONO,
            fontSize: 11,
            color: "var(--ink3)",
          }}
        >
          Interactive example
        </span>
      </div>
      {(
        [
          ["Projects", projects !== "disabled", false, "Used by Tasks"],
          ["Tasks", projects !== "disabled", false, "Needs Projects"],
          ["Docs", true, false, "Live"],
          ["Teams", true, false, "Live"],
          ["Chat", true, false, "Available"],
          ["Calendar", true, false, "Available"],
          ["HR", true, false, "Available"],
        ] as const
      ).map(([name, isOn, soon, sub]) => {
        const warn = name === "Projects" && projects === "confirm";

        return (
          <div key={name}>
            <div
              data-dim={soon ? "" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                opacity: soon ? 0.45 : 1,
                background: warn ? "var(--tile2)" : "transparent",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{name}</div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: "var(--ink3)",
                    marginTop: 2,
                  }}
                >
                  {sub}
                </div>
              </div>
              <Switch
                checked={isOn}
                aria-label={`${name} module`}
                disabled={soon || name !== "Projects"}
                onCheckedChange={() =>
                  setProjects(projects === "enabled" ? "confirm" : "enabled")
                }
                style={{
                  transition: trans,
                  background: isOn ? "var(--ink)" : "var(--line)",
                  border: soon ? "1px dashed var(--ink3)" : undefined,
                }}
              />
            </div>
            {warn ? (
              <div
                role="status"
                style={{
                  margin: "2px 4px 8px",
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  background: "var(--tile2)",
                  display: "flex",
                  gap: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: "none",
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    border: "1.5px solid var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: MONO,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  !
                </span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 14, lineHeight: 1.45 }}>
                    <strong style={{ fontWeight: 600 }}>
                      Tasks needs Projects.
                    </strong>{" "}
                    <span style={{ color: "var(--ink2)" }}>
                      Turn off both modules or keep them enabled.
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <Button
                      variant="custom"
                      type="button"
                      onClick={() => setProjects("enabled")}
                      style={{
                        height: 32,
                        padding: "0 14px",
                        borderRadius: 12,
                        border: "none",
                        background: "var(--btn)",
                        color: "var(--btn-ink)",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Keep Projects on
                    </Button>
                    <Button
                      variant="custom"
                      type="button"
                      onClick={() => setProjects("disabled")}
                      style={{
                        height: 32,
                        padding: "0 14px",
                        borderRadius: 12,
                        border: "1px solid var(--line)",
                        background: "transparent",
                        color: "var(--ink)",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Turn off both
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
